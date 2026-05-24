package integration

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func lockStressHeavyMode() bool {
	return strings.TrimSpace(os.Getenv("FOOKEE_LOCK_STRESS")) == "heavy"
}

func lockStressTotalOps(t *testing.T) int {
	t.Helper()
	if lockStressHeavyMode() {
		if s := os.Getenv("FOOKEE_LOCK_STRESS_OPS"); s != "" {
			if n, err := strconv.Atoi(s); err == nil && n > 0 {
				return n
			}
		}
		return 12000
	}
	if testing.Short() {
		return 80
	}
	return 400
}

func lockStressWorkers() int {
	if lockStressHeavyMode() {
		w := runtime.GOMAXPROCS(0) * 8
		if w < 16 {
			w = 16
		}
		if w > 96 {
			w = 96
		}
		return w
	}
	if testing.Short() {
		return 4
	}
	return 8
}

func lockStressPairTotalOps(t *testing.T) int {
	t.Helper()
	if lockStressHeavyMode() {
		if s := os.Getenv("FOOKEE_LOCK_STRESS_OPS"); s != "" {
			if n, err := strconv.Atoi(s); err == nil && n > 0 {
				return n
			}
		}
		return 12000
	}
	if testing.Short() {
		return 40
	}
	return 120
}

func isPgDeadlock(err error) bool {
	if err == nil {
		return false
	}
	var pqErr *pq.Error
	if errors.As(err, &pqErr) && pqErr.Code == "40P01" {
		return true
	}
	msg := err.Error()
	return strings.Contains(msg, "deadlock detected") || strings.Contains(msg, "40P01")
}

func updateCounterRetry(ctx context.Context, exec interface {
	UpdateByID(context.Context, string, string, map[string]interface{}) (map[string]interface{}, error)
}, id string, body map[string]interface{}, deadlockRetries *int64) error {
	const maxAttempts = 160
	var prevErr error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		_, err := exec.UpdateByID(ctx, "Counter", id, sys(body))
		if err == nil {
			return nil
		}
		prevErr = err
		if isPgDeadlock(err) {
			atomic.AddInt64(deadlockRetries, 1)
			time.Sleep(time.Millisecond * time.Duration((attempt%20)+1))
			continue
		}
		return err
	}
	return prevErr
}

func scanCounterN(t *testing.T, db *sql.DB, ctx context.Context, id string) float64 {
	t.Helper()
	var n float64
	q := `SELECT n FROM "counter" WHERE id = $1 AND deleted_at IS NULL`
	err := db.QueryRowContext(ctx, q, id).Scan(&n)
	require.NoError(t, err)
	return n
}

func TestCounterUpdateDeltaIncrementsN(t *testing.T) {
	schema := counterSimpleSchema()
	exec, db, cleanup := setupDBWithSchema(t, schema)
	defer cleanup()
	ctx := context.Background()
	row, err := exec.Create(ctx, "Counter", sys(map[string]interface{}{"n": 0.0}))
	require.NoError(t, err)
	id := row["id"].(string)
	_, err = exec.UpdateByID(ctx, "Counter", id, sys(map[string]interface{}{"delta": 1.0}))
	require.NoError(t, err)
	got := scanCounterN(t, db, ctx, id)
	require.InDelta(t, 1.0, got, 0.001)
}

func TestLockStress_SingleHotRowSerializedIncrements(t *testing.T) {
	schema := counterSimpleSchema()
	exec, db, cleanup := setupDBWithSchema(t, schema)
	defer cleanup()

	ctx := context.Background()
	row, err := exec.Create(ctx, "Counter", sys(map[string]interface{}{"n": 0.0}))
	require.NoError(t, err)
	id := row["id"].(string)

	total := lockStressTotalOps(t)
	workers := lockStressWorkers()
	if lockStressHeavyMode() && workers > 12 {
		workers = 12
	}
	if !lockStressHeavyMode() && workers > 8 {
		workers = 8
	}
	var deadlockRetries int64
	var wg sync.WaitGroup
	errCh := make(chan error, workers)

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(worker int) {
			defer wg.Done()
			for i := worker; i < total; i += workers {
				if err := updateCounterRetry(ctx, exec, id, map[string]interface{}{"delta": 1.0}, &deadlockRetries); err != nil {
					errCh <- err
					return
				}
			}
		}(w)
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		require.NoError(t, err)
	}
	t.Logf("deadlock_retries=%d (FOR UPDATE fetch + global order pre-lock)", atomic.LoadInt64(&deadlockRetries))

	got := scanCounterN(t, db, context.Background(), id)
	require.InDelta(t, float64(total), got, 0.001, "lost updates under concurrent FOR UPDATE serialization")
}

func TestLockStress_CrossRowPairConsistentTotalsUnderContention(t *testing.T) {
	schema := counterPairSchema()
	exec, db, cleanup := setupDBWithSchema(t, schema)
	defer cleanup()

	ctx := context.Background()

	a, err := exec.Create(ctx, "Counter", sys(map[string]interface{}{"n": 0.0}))
	require.NoError(t, err)
	b, err := exec.Create(ctx, "Counter", sys(map[string]interface{}{"n": 0.0}))
	require.NoError(t, err)
	idA := a["id"].(string)
	idB := b["id"].(string)
	var idLow, idHigh string
	if idA < idB {
		idLow, idHigh = idA, idB
	} else {
		idLow, idHigh = idB, idA
	}

	total := lockStressPairTotalOps(t)
	if lockStressHeavyMode() && total < 800 && !testing.Short() {
		total = 800
	}
	workers := lockStressWorkers()
	if lockStressHeavyMode() && workers > 24 {
		workers = 24
	}
	if !lockStressHeavyMode() && workers > 6 {
		workers = 6
	}

	var deadlockRetries int64
	var wg sync.WaitGroup
	errCh := make(chan error, workers)

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func(worker int) {
			defer wg.Done()
			for i := worker; i < total; i += workers {
				id := idLow
				peer := idHigh
				if i%3 != 0 {
					id, peer = peer, id
				}
				if err := updateCounterRetry(ctx, exec, id, map[string]interface{}{
					"delta":   1.0,
					"peer_id": peer,
				}, &deadlockRetries); err != nil {
					errCh <- err
					return
				}
			}
		}(w)
	}
	wg.Wait()
	close(errCh)
	for err := range errCh {
		require.NoError(t, err)
	}
	t.Logf("deadlock_retries=%d", atomic.LoadInt64(&deadlockRetries))

	ctxDone := context.Background()
	nL := scanCounterN(t, db, ctxDone, idLow)
	nH := scanCounterN(t, db, ctxDone, idHigh)
	require.InDelta(t, nL, nH, 0.001, "peer effect should keep counters equal")
	require.InDelta(t, float64(total), nL, 0.001)
}

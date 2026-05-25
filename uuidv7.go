package fookie

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

var uuidMono struct {
	mu  sync.Mutex
	ms  int64
	seq uint16
}

func newUUIDv7() string {
	uuidMono.mu.Lock()
	now := time.Now().UnixMilli()
	var seq uint16
	if now == uuidMono.ms {
		uuidMono.seq++
		seq = uuidMono.seq
	} else {
		uuidMono.ms = now
		uuidMono.seq = 0
	}
	ms := uuidMono.ms
	uuidMono.mu.Unlock()

	var b [16]byte
	b[0] = byte(ms >> 40) //nolint:gosec
	b[1] = byte(ms >> 32) //nolint:gosec
	b[2] = byte(ms >> 24) //nolint:gosec
	b[3] = byte(ms >> 16) //nolint:gosec
	b[4] = byte(ms >> 8)  //nolint:gosec
	b[5] = byte(ms)       //nolint:gosec
	b[6] = byte(0x70 | (seq>>8)&0x0f) //nolint:gosec
	b[7] = byte(seq)
	rand.Read(b[8:])
	b[8] = (b[8] & 0x3f) | 0x80

	return hex.EncodeToString(b[0:4]) + "-" +
		hex.EncodeToString(b[4:6]) + "-" +
		hex.EncodeToString(b[6:8]) + "-" +
		hex.EncodeToString(b[8:10]) + "-" +
		hex.EncodeToString(b[10:16])
}

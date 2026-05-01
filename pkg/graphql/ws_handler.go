package fookiegql

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/graphql-go/graphql"

	"github.com/fookiejs/fookie/pkg/runtime"
)

var wsUpgrader = websocket.Upgrader{
	CheckOrigin:  func(r *http.Request) bool { return true },
	Subprotocols: []string{"graphql-transport-ws"},
}

type wsMsg struct {
	ID      string          `json:"id,omitempty"`
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

func NewWSHandler(executor *runtime.Executor, schema graphql.Schema) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := wsUpgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close()

		connCtx, connCancel := context.WithCancel(r.Context())
		defer connCancel()

		baseCtx := WithExecutor(connCtx, executor)

		if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
			baseCtx = WithToken(baseCtx, strings.TrimPrefix(auth, "Bearer "))
		}
		if ak := strings.TrimSpace(r.Header.Get("X-Fookie-Admin-Key")); ak != "" {
			baseCtx = WithAdminKey(baseCtx, ak)
		}

		type activeSub struct{ cancel context.CancelFunc }
		var subsMu sync.Mutex
		subs := map[string]*activeSub{}

		cancelAll := func() {
			subsMu.Lock()
			defer subsMu.Unlock()
			for _, s := range subs {
				s.cancel()
			}
			subs = map[string]*activeSub{}
		}
		defer cancelAll()

		sendJSON := func(msg wsMsg) error {
			b, _ := json.Marshal(msg)
			return conn.WriteMessage(websocket.TextMessage, b)
		}

		for {
			_, raw, err := conn.ReadMessage()
			if err != nil {
				return
			}

			var msg wsMsg
			if err := json.Unmarshal(raw, &msg); err != nil {
				return
			}

			switch msg.Type {

			case "connection_init":
				if len(msg.Payload) > 0 {
					var params struct {
						AdminKey string `json:"adminKey"`
						Token    string `json:"token"`
					}
					if json.Unmarshal(msg.Payload, &params) == nil {
						if params.AdminKey != "" {
							baseCtx = WithAdminKey(baseCtx, params.AdminKey)
						}
						if params.Token != "" {
							baseCtx = WithToken(baseCtx, params.Token)
						}
					}
				}
				_ = sendJSON(wsMsg{Type: "connection_ack"})

			case "ping":
				_ = sendJSON(wsMsg{Type: "pong"})

			case "subscribe":
				var payload struct {
					Query         string                 `json:"query"`
					OperationName string                 `json:"operationName"`
					Variables     map[string]interface{} `json:"variables"`
				}
				if err := json.Unmarshal(msg.Payload, &payload); err != nil {
					continue
				}

				subCtx, subCancel := context.WithCancel(baseCtx)
				subsMu.Lock()
				subs[msg.ID] = &activeSub{cancel: subCancel}
				subsMu.Unlock()

				go func(id string, ctx context.Context) {
					ch := graphql.Subscribe(graphql.Params{
						Schema:         schema,
						RequestString:  payload.Query,
						VariableValues: payload.Variables,
						OperationName:  payload.OperationName,
						Context:        ctx,
					})
					for res := range ch {
						payloadBytes, _ := json.Marshal(res)
						if err := sendJSON(wsMsg{
							Type:    "next",
							ID:      id,
							Payload: json.RawMessage(payloadBytes),
						}); err != nil {
							return
						}
					}
					_ = sendJSON(wsMsg{Type: "complete", ID: id})
					subsMu.Lock()
					delete(subs, id)
					subsMu.Unlock()
				}(msg.ID, subCtx)

			case "complete":
				subsMu.Lock()
				if s, ok := subs[msg.ID]; ok {
					s.cancel()
					delete(subs, msg.ID)
				}
				subsMu.Unlock()
			}
		}
	})
}

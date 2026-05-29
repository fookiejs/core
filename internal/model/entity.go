package model

type EntityStatus string

const (
	EntityStatusPending EntityStatus = "pending"
	EntityStatusActive  EntityStatus = "active"
	EntityStatusFailed  EntityStatus = "failed"
)

func (s EntityStatus) String() string { return string(s) }

type Entity[S any] struct {
	ID     ID
	Status EntityStatus
	Data   S
}

type OpResult struct {
	ID      ID
	Pending bool
}

type Record struct {
	ID     ID
	Status EntityStatus
	Error  string
	Data   any
}

type FailPanic struct{ Err error }

package schemawire

type Signal uint8

const (
	Done Signal = iota
	Running
	Failed
)

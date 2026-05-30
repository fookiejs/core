package schemawire

type EnumDef struct {
	Name   string
	Values []string
}

func DefineEnum(name string, values ...string) *EnumDef {
	return &EnumDef{Name: name, Values: values}
}

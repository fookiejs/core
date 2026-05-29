package semantic

type Base struct {
	ID        ID
	CreatedAt Timestamp
	UpdatedAt Timestamp
	IsDeleted Bool
}

var protectedBaseFields = map[string]struct{}{
	"CreatedAt": {},
	"UpdatedAt": {},
	"IsDeleted": {},
}

func IsProtectedBaseField(name string) bool {
	_, ok := protectedBaseFields[name]
	return ok
}

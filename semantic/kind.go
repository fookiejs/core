package semantic

type Kind string

const (
	StringKind     Kind = "string"
	Int64Kind      Kind = "int64"
	Float64Kind    Kind = "float64"
	BoolKind       Kind = "bool"
	IDKind         Kind = "uuidv7"
	CurrencyKind   Kind = "currency"
	EmailKind      Kind = "email"
	JSONKind       Kind = "json"
	EnumKind       Kind = "enum"
	TimestampKind  Kind = "timestamp"
	DateKind       Kind = "date"
	URLKind        Kind = "url"
	PhoneKind      Kind = "phone"
	UUIDKind       Kind = "uuid"
	ColorKind      Kind = "color"
	LocaleKind     Kind = "locale"
	IBANKind       Kind = "iban"
	IPKind         Kind = "ip"
	CoordinateKind Kind = "coordinate"
)

type TypedField interface {
	Kind() Kind
}

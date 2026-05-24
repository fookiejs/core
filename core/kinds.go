package fookie

// kind — storage-level column type identifier.
type kind string

const (
	stringKind     kind = "string"
	int64Kind      kind = "int64"
	float64Kind    kind = "float64"
	boolKind       kind = "bool"
	idKind         kind = "uuidv7"
	currencyKind   kind = "currency"
	emailKind      kind = "email"
	jsonKind       kind = "json"
	enumKind       kind = "enum"
	timestampKind  kind = "timestamp"
	dateKind       kind = "date"
	urlKind        kind = "url"
	phoneKind      kind = "phone"
	uuidKind       kind = "uuid"
	colorKind      kind = "color"
	localeKind     kind = "locale"
	ibanKind       kind = "iban"
	ipKind         kind = "ip"
	coordinateKind kind = "coordinate"
)

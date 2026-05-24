package ast


type Schema struct {
	Models    []*Model
	Externals []*External
	Modules   []*Module
	Enums     []*Enum
	Seeds     []*SeedBlock
	Crons     []*CronBlock
	Configs   []*ConfigEntry
}

type Enum struct {
	Name   string
	Values []string
	LineNo int
}

type ConfigEntry struct {
	Key    string
	Type   FieldType
	Value  interface{}
	LineNo int
}

type SeedBlock struct {
	Parts []*SeedPart
}

type SeedPart struct {
	Entry *SeedEntry
	Stmts []Statement
}

type SeedEntry struct {
	Model    string
	KeyField string
	Records  []map[string]interface{}
}

type CronBlock struct {
	Entries []*CronEntry
}

type CronEntry struct {
	Name     string
	CronExpr string
	Body     *Block
}

type IndexDef struct {
	Unique  bool     // true = UNIQUE INDEX
	Columns []string // column names in order (e.g. ["email"], ["tenant_id","email"])
	Desc    []bool   // parallel to Columns: true = DESC
	Where   string   // optional partial-index WHERE clause (raw SQL)
}

type Model struct {
	Name    string
	Fields  []*Field
	CRUD    map[string]*Operation
	Uses    []string
	Indexes []IndexDef
}

// Validator is a field-level validation rule parsed from the schema.
// Arg is nil for zero-argument validators (required), a float64 for numeric
// constraints (min/max), and a string for pattern.
type Validator struct {
	Name string
	Arg  interface{}
}

type Field struct {
	Name        string
	Type        FieldType
	Relation    *string
	EnumRef     *string
	Default     interface{}
	Constraints []string
	Validators  []Validator
}

type FieldType string

const (
	TypeString    FieldType = "string"
	TypeNumber    FieldType = "number"
	TypeBoolean   FieldType = "boolean"
	TypeID        FieldType = "id"
	TypeDate      FieldType = "date"
	TypeTimestamp FieldType = "timestamp"
	TypeJSON      FieldType = "json"
	TypeRelation  FieldType = "relation"

	TypeEnum       FieldType = "enum"

	TypeEmail      FieldType = "email"
	TypeURL        FieldType = "url"
	TypePhone      FieldType = "phone"
	TypeUUID       FieldType = "uuid"
	TypeCoordinate FieldType = "coordinate"
	TypeColor      FieldType = "color"
	TypeCurrency   FieldType = "currency"
	TypeLocale     FieldType = "locale"
	TypeIBAN       FieldType = "iban"
	TypeIPAddress  FieldType = "ipaddress"
)

type Operation struct {
	Type         string
	Field        string
	Before       *Block
	BeforeParams []string
	After        *Block
	AfterParams  []string
	Filter       *FilterClause
	OrderBy      []*OrderBy
	Cursor       *Cursor
	Select       []*SelectField
}

type SelectField struct {
	Alias string
	Expr  SelectExpr
}

type SelectExpr interface {
	selectExprMarker()
}

type PlainField struct {
	Path []string
}

func (PlainField) selectExprMarker() {}

type AggregateFunc struct {
	Fn    string
	Field []string
}

func (AggregateFunc) selectExprMarker() {}

type Block struct {
	Statements []Statement
}

type Statement interface {
	statementMarker()
}

type Assignment struct {
	Name   string
	Value  Expression
	LineNo int
}

func (Assignment) statementMarker() {}

type ModifyAssignment struct {
	Field  string
	Value  Expression
	LineNo int
}

func (ModifyAssignment) statementMarker() {}

type PredicateExpr struct {
	Expr   Expression
	LineNo int
}

func (PredicateExpr) statementMarker()  {}
func (PredicateExpr) expressionMarker() {}

type Expression interface {
	expressionMarker()
}

type ExternalCall struct {
	Name   string
	Params map[string]Expression
	LineNo int
}

func (ExternalCall) expressionMarker() {}

type BuiltinCall struct {
	Name   string
	Args   []Expression
	LineNo int
}

func (BuiltinCall) expressionMarker() {}

// QueryFilter is the structured filter block: { field: op val op val, field: ... }
type QueryFilter struct {
	Fields []*QueryFieldFilter
}

type QueryFieldFilter struct {
	Field string
	Ops   []*QueryOp
}

type QueryOp struct {
	Op    string     // eq neq gt gte lt lte in notIn contains isNull isNotNull
	Value Expression // nil for isNull/isNotNull
}

type ReadQuery struct {
	Model  string
	Filter *QueryFilter
	Lock   bool
	One    bool
	Select []string
	LineNo int
}

func (ReadQuery) expressionMarker() {}

type CountQuery struct {
	Model  string
	Filter *QueryFilter
	LineNo int
}

func (CountQuery) expressionMarker() {}

type SumQuery struct {
	Model  string
	Field  string
	Filter *QueryFilter
	LineNo int
}

func (SumQuery) expressionMarker() {}

type FieldProjectionExpr struct {
	Model  string
	Field  string
	Source Expression
	LineNo int
}

func (FieldProjectionExpr) expressionMarker() {}

type BulkUpdateStmt struct {
	Model  string
	Filter *QueryFilter
	Fields []*ModifyAssignment
	LineNo int
}

func (*BulkUpdateStmt) statementMarker() {}

type BulkDeleteStmt struct {
	Model  string
	Filter *QueryFilter
	LineNo int
}

func (*BulkDeleteStmt) statementMarker() {}

type FieldAccess struct {
	Object string
	Fields []string
	LineNo int
}

func (FieldAccess) expressionMarker() {}

type Literal struct {
	Value  interface{}
	LineNo int
}

func (Literal) expressionMarker() {}

type BinaryOp struct {
	Left   Expression
	Op     string
	Right  Expression
	LineNo int
}

func (BinaryOp) expressionMarker() {}

type UnaryOp struct {
	Op     string
	Right  Expression
	LineNo int
}

func (UnaryOp) expressionMarker() {}

type InExpr struct {
	Left   Expression
	Values []Expression
	LineNo int
}

func (InExpr) expressionMarker() {}

type ArrayLiteral struct {
	Items  []Expression
	LineNo int
}

func (ArrayLiteral) expressionMarker() {}

type EffectUpdateStmt struct {
	Model  string
	IDExpr Expression
	Fields []*ModifyAssignment
	LineNo int
}

func (*EffectUpdateStmt) statementMarker() {}

type EffectDeleteStmt struct {
	Model  string
	IDExpr Expression
	LineNo int
}

func (*EffectDeleteStmt) statementMarker() {}

type EffectCreateStmt struct {
	Model  string
	Fields []*ModifyAssignment
	LineNo int
}

func (*EffectCreateStmt) statementMarker() {}


type EffectNotifyStmt struct {
	RoomName string
	Payload  map[string]Expression
	LineNo   int
}

func (*EffectNotifyStmt) statementMarker() {}

type ForIn struct {
	Var      string
	Iterable Expression
	Body     *Block
	LineNo   int
}

func (ForIn) statementMarker() {}

type IfStmt struct {
	Condition Expression
	Then      *Block
	LineNo    int
}

func (*IfStmt) statementMarker() {}

type FilterInjectStmt struct {
	Field  string
	Value  Expression
	Op     string
	LineNo int
}

func (*FilterInjectStmt) statementMarker() {}

type FilterClause struct {
	Conditions []Expression
}

type OrderBy struct {
	Field string
	Desc  bool
}

type Cursor struct {
	Size  int
	After *string
}

type External struct {
	Name   string
	Input  map[string]string
	Output map[string]string

	// Retry policy — configurable from FQL.
	// RetryMax: max attempts before marking failed (0 → default 3).
	// RetryBackoff: "none" | "linear" | "exponential" (default "exponential").
	// RetryMaxDelay: cap for backoff in seconds (0 → no cap).
	RetryMax      int
	RetryBackoff  string
	RetryMaxDelay int

}

type ModuleOpHooks struct {
	Before *Block
	After  *Block
}

type Module struct {
	Name   string
	Before *Block
	After  *Block
	CRUD   map[string]*ModuleOpHooks
}


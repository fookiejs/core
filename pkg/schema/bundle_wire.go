package schema

import "github.com/fookiejs/fookie/pkg/ast"

type schemaWire struct {
	Models    []*modelWire    `json:"models"`
	Externals []*externalWire `json:"externals,omitempty"`
	Modules   []*moduleWire   `json:"modules,omitempty"`
	Enums     []*enumWire     `json:"enums,omitempty"`
	Seeds     []*seedBlockWire `json:"seeds,omitempty"`
	Crons     []*cronBlockWire `json:"crons,omitempty"`
	Configs   []*configWire   `json:"configs,omitempty"`
}

type enumWire struct {
	Name   string   `json:"name"`
	Values []string `json:"values"`
	LineNo int      `json:"lineNo,omitempty"`
}

type configWire struct {
	Key        string           `json:"key"`
	Type       string           `json:"type"`
	EnumRef    *string          `json:"enumRef,omitempty"`
	Validators []validatorWire  `json:"validators,omitempty"`
	Value      any              `json:"value,omitempty"`
	LineNo     int              `json:"lineNo,omitempty"`
}

type seedBlockWire struct {
	Parts []*seedPartWire `json:"parts"`
}

type seedPartWire struct {
	Entry *seedEntryWire `json:"entry,omitempty"`
	Stmts []stmtWire     `json:"stmts,omitempty"`
}

type seedEntryWire struct {
	Model    string           `json:"model"`
	KeyField string           `json:"keyField"`
	Records  []map[string]any `json:"records"`
}

type cronBlockWire struct {
	Entries []*cronEntryWire `json:"entries"`
}

type cronEntryWire struct {
	Name     string     `json:"name"`
	CronExpr string     `json:"cronExpr"`
	Body     *blockWire `json:"body"`
}

type modelWire struct {
	Name    string              `json:"name"`
	Fields  []*fieldWire        `json:"fields"`
	CRUD    map[string]*opWire  `json:"crud,omitempty"`
	Uses    []string            `json:"uses,omitempty"`
	Indexes []indexDefWire      `json:"indexes,omitempty"`
}

type indexDefWire struct {
	Unique  bool     `json:"unique,omitempty"`
	Columns []string `json:"columns"`
	Desc    []bool   `json:"desc,omitempty"`
	Where   string   `json:"where,omitempty"`
}

type fieldWire struct {
	Name        string          `json:"name"`
	Type        string          `json:"type"`
	Relation    *string         `json:"relation,omitempty"`
	EnumRef     *string         `json:"enumRef,omitempty"`
	Default     any             `json:"default,omitempty"`
	Constraints []string        `json:"constraints,omitempty"`
	Validators  []validatorWire `json:"validators,omitempty"`
}

type validatorWire struct {
	Name string `json:"name"`
	Arg  any    `json:"arg,omitempty"`
}

type opWire struct {
	Type         string          `json:"type"`
	Field        string          `json:"field,omitempty"`
	Before       *blockWire      `json:"before,omitempty"`
	BeforeParams []string        `json:"beforeParams,omitempty"`
	After        *blockWire      `json:"after,omitempty"`
	AfterParams  []string        `json:"afterParams,omitempty"`
	Filter       *filterWire     `json:"filter,omitempty"`
	OrderBy      []*orderByWire  `json:"orderBy,omitempty"`
	Cursor       *cursorWire     `json:"cursor,omitempty"`
	Select       []*selectFieldWire `json:"select,omitempty"`
}

type selectFieldWire struct {
	Alias string       `json:"alias,omitempty"`
	Expr  selectExprWire `json:"expr"`
}

type selectExprWire struct {
	Kind    string   `json:"kind"`
	Fn      string   `json:"fn,omitempty"`
	Field   []string `json:"field,omitempty"`
	Path    []string `json:"path,omitempty"`
}

type filterWire struct {
	Conditions []exprWire `json:"conditions"`
}

type orderByWire struct {
	Field string `json:"field"`
	Desc  bool   `json:"desc,omitempty"`
}

type cursorWire struct {
	Size  int     `json:"size"`
	After *string `json:"after,omitempty"`
}

type blockWire struct {
	Statements []stmtWire `json:"statements"`
}

type stmtWire struct {
	Kind string `json:"kind"`
	Expr *exprWire `json:"expr,omitempty"`
	assignName   string            `json:"assignName,omitempty"`
	modifyField  string            `json:"modifyField,omitempty"`
	model        string            `json:"model,omitempty"`
	idExpr       *exprWire         `json:"idExpr,omitempty"`
	fields       []modifyFieldWire `json:"fields,omitempty"`
	filter       *queryFilterWire  `json:"filter,omitempty"`
	roomName     string            `json:"roomName,omitempty"`
	payload      map[string]exprWire `json:"payload,omitempty"`
	varName      string            `json:"varName,omitempty"`
	iterable     *exprWire         `json:"iterable,omitempty"`
	body         *blockWire        `json:"body,omitempty"`
	condition    *exprWire         `json:"condition,omitempty"`
	then         *blockWire        `json:"then,omitempty"`
	injectField  string            `json:"injectField,omitempty"`
	injectValue  *exprWire         `json:"injectValue,omitempty"`
	injectOp     string            `json:"injectOp,omitempty"`
	lock         bool              `json:"lock,omitempty"`
	lineNo       int               `json:"lineNo,omitempty"`
}

type modifyFieldWire struct {
	Field string    `json:"field"`
	Value exprWire  `json:"value"`
	LineNo int      `json:"lineNo,omitempty"`
}

type exprWire struct {
	Kind string `json:"kind"`
	literalValue any `json:"literalValue,omitempty"`
	object       string `json:"object,omitempty"`
	fields       []string `json:"fields,omitempty"`
	left         *exprWire `json:"left,omitempty"`
	op           string `json:"op,omitempty"`
	right        *exprWire `json:"right,omitempty"`
	unaryOp      string `json:"unaryOp,omitempty"`
	inLeft       *exprWire `json:"inLeft,omitempty"`
	inValues     []exprWire `json:"inValues,omitempty"`
	items        []exprWire `json:"items,omitempty"`
	extName      string `json:"extName,omitempty"`
	extParams    map[string]exprWire `json:"extParams,omitempty"`
	builtinName  string `json:"builtinName,omitempty"`
	builtinArgs  []exprWire `json:"builtinArgs,omitempty"`
	readModel    string `json:"readModel,omitempty"`
	readFilter   *queryFilterWire `json:"readFilter,omitempty"`
	readLock     bool `json:"readLock,omitempty"`
	readOne      bool `json:"readOne,omitempty"`
	readSelect   []string `json:"readSelect,omitempty"`
	countModel   string `json:"countModel,omitempty"`
	countFilter  *queryFilterWire `json:"countFilter,omitempty"`
	sumModel     string `json:"sumModel,omitempty"`
	sumField     string `json:"sumField,omitempty"`
	sumFilter    *queryFilterWire `json:"sumFilter,omitempty"`
	projectionModel  string       `json:"projectionModel,omitempty"`
	projectionField  string       `json:"projectionField,omitempty"`
	projectionSource *exprWire    `json:"projectionSource,omitempty"`
	lineNo       int `json:"lineNo,omitempty"`
}

type queryFilterWire struct {
	Fields []queryFieldFilterWire `json:"fields"`
}

type queryFieldFilterWire struct {
	Field string       `json:"field"`
	Ops   []queryOpWire `json:"ops"`
}

type queryOpWire struct {
	Op    string    `json:"op"`
	Value *exprWire `json:"value,omitempty"`
}

type externalWire struct {
	Name          string            `json:"name"`
	Input         map[string]string `json:"input"`
	Output        map[string]string `json:"output"`
	RetryMax      int               `json:"retryMax,omitempty"`
	RetryBackoff  string            `json:"retryBackoff,omitempty"`
	RetryMaxDelay int               `json:"retryMaxDelay,omitempty"`
}

type moduleOpWire struct {
	Before *blockWire `json:"before,omitempty"`
	After  *blockWire `json:"after,omitempty"`
}

type moduleWire struct {
	Name   string                  `json:"name"`
	Before *blockWire              `json:"before,omitempty"`
	After  *blockWire              `json:"after,omitempty"`
	CRUD   map[string]*moduleOpWire `json:"crud,omitempty"`
}

func encodeSchema(s *ast.Schema) *schemaWire {
	w := &schemaWire{}
	for _, m := range s.Models {
		w.Models = append(w.Models, encodeModel(m))
	}
	for _, e := range s.Externals {
		w.Externals = append(w.Externals, encodeExternal(e))
	}
	for _, m := range s.Modules {
		w.Modules = append(w.Modules, encodeModule(m))
	}
	for _, e := range s.Enums {
		w.Enums = append(w.Enums, &enumWire{Name: e.Name, Values: e.Values, LineNo: e.LineNo})
	}
	for _, sb := range s.Seeds {
		w.Seeds = append(w.Seeds, encodeSeedBlock(sb))
	}
	for _, cb := range s.Crons {
		w.Crons = append(w.Crons, encodeCronBlock(cb))
	}
	for _, c := range s.Configs {
		w.Configs = append(w.Configs, encodeConfig(c))
	}
	return w
}

func decodeSchema(w *schemaWire) *ast.Schema {
	s := &ast.Schema{}
	for _, m := range w.Models {
		s.Models = append(s.Models, decodeModel(m))
	}
	for _, e := range w.Externals {
		s.Externals = append(s.Externals, decodeExternal(e))
	}
	for _, m := range w.Modules {
		s.Modules = append(s.Modules, decodeModule(m))
	}
	for _, e := range w.Enums {
		s.Enums = append(s.Enums, &ast.Enum{Name: e.Name, Values: e.Values, LineNo: e.LineNo})
	}
	for _, sb := range w.Seeds {
		s.Seeds = append(s.Seeds, decodeSeedBlock(sb))
	}
	for _, cb := range w.Crons {
		s.Crons = append(s.Crons, decodeCronBlock(cb))
	}
	for _, c := range w.Configs {
		s.Configs = append(s.Configs, decodeConfig(c))
	}
	return s
}

func encodeModel(m *ast.Model) *modelWire {
	w := &modelWire{Name: m.Name, Uses: m.Uses}
	for _, f := range m.Fields {
		w.Fields = append(w.Fields, encodeField(f))
	}
	if len(m.CRUD) > 0 {
		w.CRUD = map[string]*opWire{}
		for k, op := range m.CRUD {
			w.CRUD[k] = encodeOp(op)
		}
	}
	for _, idx := range m.Indexes {
		w.Indexes = append(w.Indexes, indexDefWire{Unique: idx.Unique, Columns: idx.Columns, Desc: idx.Desc, Where: idx.Where})
	}
	return w
}

func decodeModel(w *modelWire) *ast.Model {
	m := &ast.Model{Name: w.Name, Uses: w.Uses}
	for _, f := range w.Fields {
		m.Fields = append(m.Fields, decodeField(f))
	}
	if len(w.CRUD) > 0 {
		m.CRUD = map[string]*ast.Operation{}
		for k, op := range w.CRUD {
			m.CRUD[k] = decodeOp(op)
		}
	}
	for _, idx := range w.Indexes {
		m.Indexes = append(m.Indexes, ast.IndexDef{Unique: idx.Unique, Columns: idx.Columns, Desc: idx.Desc, Where: idx.Where})
	}
	return m
}

func encodeConfig(c *ast.ConfigEntry) *configWire {
	if c == nil {
		return nil
	}
	return &configWire{Key: c.Key, Type: string(c.Type), Value: c.Value, LineNo: c.LineNo}
}

func decodeConfig(w *configWire) *ast.ConfigEntry {
	if w == nil {
		return nil
	}
	return &ast.ConfigEntry{Key: w.Key, Type: ast.FieldType(w.Type), Value: w.Value, LineNo: w.LineNo}
}

func encodeField(f *ast.Field) *fieldWire {
	w := &fieldWire{
		Name: f.Name, Type: string(f.Type), Relation: f.Relation, EnumRef: f.EnumRef,
		Default: f.Default, Constraints: f.Constraints,
	}
	for _, v := range f.Validators {
		w.Validators = append(w.Validators, validatorWire{Name: v.Name, Arg: v.Arg})
	}
	return w
}

func decodeField(w *fieldWire) *ast.Field {
	f := &ast.Field{
		Name: w.Name, Type: ast.FieldType(w.Type), Relation: w.Relation, EnumRef: w.EnumRef,
		Default: w.Default, Constraints: w.Constraints,
	}
	for _, v := range w.Validators {
		f.Validators = append(f.Validators, ast.Validator{Name: v.Name, Arg: v.Arg})
	}
	return f
}

func encodeExternal(e *ast.External) *externalWire {
	return &externalWire{
		Name: e.Name, Input: e.Input, Output: e.Output,
		RetryMax: e.RetryMax, RetryBackoff: e.RetryBackoff, RetryMaxDelay: e.RetryMaxDelay,
	}
}

func decodeExternal(w *externalWire) *ast.External {
	return &ast.External{
		Name: w.Name, Input: w.Input, Output: w.Output,
		RetryMax: w.RetryMax, RetryBackoff: w.RetryBackoff, RetryMaxDelay: w.RetryMaxDelay,
	}
}

func encodeModule(m *ast.Module) *moduleWire {
	w := &moduleWire{Name: m.Name, Before: encodeBlock(m.Before), After: encodeBlock(m.After)}
	if len(m.CRUD) > 0 {
		w.CRUD = map[string]*moduleOpWire{}
		for k, h := range m.CRUD {
			w.CRUD[k] = &moduleOpWire{Before: encodeBlock(h.Before), After: encodeBlock(h.After)}
		}
	}
	return w
}

func decodeModule(w *moduleWire) *ast.Module {
	m := &ast.Module{Name: w.Name, Before: decodeBlock(w.Before), After: decodeBlock(w.After)}
	if len(w.CRUD) > 0 {
		m.CRUD = map[string]*ast.ModuleOpHooks{}
		for k, h := range w.CRUD {
			m.CRUD[k] = &ast.ModuleOpHooks{Before: decodeBlock(h.Before), After: decodeBlock(h.After)}
		}
	}
	return m
}

func encodeSeedBlock(sb *ast.SeedBlock) *seedBlockWire {
	w := &seedBlockWire{}
	for _, p := range sb.Parts {
		wp := &seedPartWire{}
		if p.Entry != nil {
			wp.Entry = &seedEntryWire{Model: p.Entry.Model, KeyField: p.Entry.KeyField, Records: p.Entry.Records}
		}
		for _, st := range p.Stmts {
			wp.Stmts = append(wp.Stmts, encodeStmt(st))
		}
		w.Parts = append(w.Parts, wp)
	}
	return w
}

func decodeSeedBlock(w *seedBlockWire) *ast.SeedBlock {
	sb := &ast.SeedBlock{}
	for _, p := range w.Parts {
		sp := &ast.SeedPart{}
		if p.Entry != nil {
			sp.Entry = &ast.SeedEntry{Model: p.Entry.Model, KeyField: p.Entry.KeyField, Records: p.Entry.Records}
		}
		for _, st := range p.Stmts {
			sp.Stmts = append(sp.Stmts, decodeStmt(st))
		}
		sb.Parts = append(sb.Parts, sp)
	}
	return sb
}

func encodeCronBlock(cb *ast.CronBlock) *cronBlockWire {
	w := &cronBlockWire{}
	for _, e := range cb.Entries {
		w.Entries = append(w.Entries, &cronEntryWire{Name: e.Name, CronExpr: e.CronExpr, Body: encodeBlock(e.Body)})
	}
	return w
}

func decodeCronBlock(w *cronBlockWire) *ast.CronBlock {
	cb := &ast.CronBlock{}
	for _, e := range w.Entries {
		cb.Entries = append(cb.Entries, &ast.CronEntry{Name: e.Name, CronExpr: e.CronExpr, Body: decodeBlock(e.Body)})
	}
	return cb
}

func encodeOp(op *ast.Operation) *opWire {
	if op == nil {
		return nil
	}
	w := &opWire{
		Type: op.Type, Field: op.Field,
		Before: encodeBlock(op.Before), BeforeParams: op.BeforeParams,
		After: encodeBlock(op.After), AfterParams: op.AfterParams,
		OrderBy: encodeOrderBy(op.OrderBy), Cursor: encodeCursor(op.Cursor),
	}
	if op.Filter != nil {
		w.Filter = &filterWire{Conditions: encodeExprs(op.Filter.Conditions)}
	}
	for _, sf := range op.Select {
		w.Select = append(w.Select, encodeSelectField(sf))
	}
	return w
}

func decodeOp(w *opWire) *ast.Operation {
	if w == nil {
		return nil
	}
	op := &ast.Operation{
		Type: w.Type, Field: w.Field,
		Before: decodeBlock(w.Before), BeforeParams: w.BeforeParams,
		After: decodeBlock(w.After), AfterParams: w.AfterParams,
		OrderBy: decodeOrderBy(w.OrderBy), Cursor: decodeCursor(w.Cursor),
	}
	if w.Filter != nil {
		op.Filter = &ast.FilterClause{Conditions: decodeExprs(w.Filter.Conditions)}
	}
	for _, sf := range w.Select {
		op.Select = append(op.Select, decodeSelectField(sf))
	}
	return op
}

func encodeSelectField(sf *ast.SelectField) *selectFieldWire {
	return &selectFieldWire{Alias: sf.Alias, Expr: encodeSelectExpr(sf.Expr)}
}

func decodeSelectField(w *selectFieldWire) *ast.SelectField {
	return &ast.SelectField{Alias: w.Alias, Expr: decodeSelectExpr(w.Expr)}
}

func encodeSelectExpr(se ast.SelectExpr) selectExprWire {
	switch v := se.(type) {
	case *ast.PlainField:
		return selectExprWire{Kind: "plain", Path: v.Path}
	case *ast.AggregateFunc:
		return selectExprWire{Kind: "aggregate", Fn: v.Fn, Field: v.Field}
	default:
		return selectExprWire{Kind: "plain"}
	}
}

func decodeSelectExpr(w selectExprWire) ast.SelectExpr {
	switch w.Kind {
	case "aggregate":
		return &ast.AggregateFunc{Fn: w.Fn, Field: w.Field}
	default:
		return &ast.PlainField{Path: w.Path}
	}
}

func encodeOrderBy(ob []*ast.OrderBy) []*orderByWire {
	var out []*orderByWire
	for _, o := range ob {
		out = append(out, &orderByWire{Field: o.Field, Desc: o.Desc})
	}
	return out
}

func decodeOrderBy(w []*orderByWire) []*ast.OrderBy {
	var out []*ast.OrderBy
	for _, o := range w {
		out = append(out, &ast.OrderBy{Field: o.Field, Desc: o.Desc})
	}
	return out
}

func encodeCursor(c *ast.Cursor) *cursorWire {
	if c == nil {
		return nil
	}
	return &cursorWire{Size: c.Size, After: c.After}
}

func decodeCursor(w *cursorWire) *ast.Cursor {
	if w == nil {
		return nil
	}
	return &ast.Cursor{Size: w.Size, After: w.After}
}

func encodeBlock(b *ast.Block) *blockWire {
	if b == nil {
		return nil
	}
	w := &blockWire{}
	for _, st := range b.Statements {
		w.Statements = append(w.Statements, encodeStmt(st))
	}
	return w
}

func decodeBlock(w *blockWire) *ast.Block {
	if w == nil {
		return nil
	}
	b := &ast.Block{}
	for _, st := range w.Statements {
		b.Statements = append(b.Statements, decodeStmt(st))
	}
	return b
}

func encodeStmt(st ast.Statement) stmtWire {
	switch v := st.(type) {
	case *ast.Assignment:
		return stmtWire{Kind: "assignment", assignName: v.Name, Expr: encodeExpr(v.Value), lineNo: v.LineNo}
	case *ast.ModifyAssignment:
		return stmtWire{Kind: "modifyAssign", modifyField: v.Field, Expr: encodeExpr(v.Value), lineNo: v.LineNo}
	case *ast.PredicateExpr:
		return stmtWire{Kind: "predicate", Expr: encodeExpr(v.Expr), lineNo: v.LineNo}
	case *ast.BulkUpdateStmt:
		return stmtWire{Kind: "bulkUpdate", model: v.Model, filter: encodeQueryFilter(v.Filter), fields: encodeModifyFields(v.Fields), lineNo: v.LineNo}
	case *ast.BulkDeleteStmt:
		return stmtWire{Kind: "bulkDelete", model: v.Model, filter: encodeQueryFilter(v.Filter), lineNo: v.LineNo}
	case *ast.EffectUpdateStmt:
		sw := stmtWire{Kind: "effectUpdate", model: v.Model, fields: encodeModifyFields(v.Fields), lineNo: v.LineNo}
		if v.IDExpr != nil {
			e := encodeExpr(v.IDExpr)
			sw.idExpr = e
		}
		return sw
	case *ast.EffectDeleteStmt:
		sw := stmtWire{Kind: "effectDelete", model: v.Model, lineNo: v.LineNo}
		if v.IDExpr != nil {
			sw.idExpr = encodeExpr(v.IDExpr)
		}
		return sw
	case *ast.EffectCreateStmt:
		return stmtWire{Kind: "effectCreate", model: v.Model, fields: encodeModifyFields(v.Fields), lineNo: v.LineNo}
	case *ast.EffectNotifyStmt:
		p := map[string]exprWire{}
		for k, e := range v.Payload {
			x := encodeExpr(e)
			p[k] = *x
		}
		return stmtWire{Kind: "effectNotify", roomName: v.RoomName, payload: p, lineNo: v.LineNo}
	case *ast.ForIn:
		sw := stmtWire{Kind: "forIn", varName: v.Var, body: encodeBlock(v.Body), lineNo: v.LineNo}
		if v.Iterable != nil {
			sw.iterable = encodeExpr(v.Iterable)
		}
		return sw
	case *ast.IfStmt:
		sw := stmtWire{Kind: "if", then: encodeBlock(v.Then), lineNo: v.LineNo}
		if v.Condition != nil {
			sw.condition = encodeExpr(v.Condition)
		}
		return sw
	case *ast.FilterInjectStmt:
		op := v.Op
		if op == "" {
			op = "eq"
		}
		sw := stmtWire{Kind: "filterInject", injectField: v.Field, injectOp: op, lineNo: v.LineNo}
		if v.Value != nil {
			sw.injectValue = encodeExpr(v.Value)
		}
		return sw
	default:
		return stmtWire{Kind: "unknown"}
	}
}

func decodeStmt(w stmtWire) ast.Statement {
	switch w.Kind {
	case "assignment":
		return &ast.Assignment{Name: w.assignName, Value: decodeExprPtr(w.Expr), LineNo: w.lineNo}
	case "modifyAssign":
		return &ast.ModifyAssignment{Field: w.modifyField, Value: decodeExprPtr(w.Expr), LineNo: w.lineNo}
	case "predicate":
		return &ast.PredicateExpr{Expr: decodeExprPtr(w.Expr), LineNo: w.lineNo}
	case "bulkUpdate":
		return &ast.BulkUpdateStmt{Model: w.model, Filter: decodeQueryFilter(w.filter), Fields: decodeModifyFields(w.fields), LineNo: w.lineNo}
	case "bulkDelete":
		return &ast.BulkDeleteStmt{Model: w.model, Filter: decodeQueryFilter(w.filter), LineNo: w.lineNo}
	case "effectUpdate":
		var id ast.Expression
		if w.idExpr != nil {
			id = decodeExpr(*w.idExpr)
		}
		return &ast.EffectUpdateStmt{Model: w.model, IDExpr: id, Fields: decodeModifyFields(w.fields), LineNo: w.lineNo}
	case "effectDelete":
		var id ast.Expression
		if w.idExpr != nil {
			id = decodeExpr(*w.idExpr)
		}
		return &ast.EffectDeleteStmt{Model: w.model, IDExpr: id, LineNo: w.lineNo}
	case "effectCreate":
		return &ast.EffectCreateStmt{Model: w.model, Fields: decodeModifyFields(w.fields), LineNo: w.lineNo}
	case "effectNotify":
		p := map[string]ast.Expression{}
		for k, e := range w.payload {
			p[k] = decodeExpr(e)
		}
		return &ast.EffectNotifyStmt{RoomName: w.roomName, Payload: p, LineNo: w.lineNo}
	case "forIn":
		var it ast.Expression
		if w.iterable != nil {
			it = decodeExpr(*w.iterable)
		}
		return &ast.ForIn{Var: w.varName, Iterable: it, Body: decodeBlock(w.body), LineNo: w.lineNo}
	case "if":
		var cond ast.Expression
		if w.condition != nil {
			cond = decodeExpr(*w.condition)
		}
		return &ast.IfStmt{Condition: cond, Then: decodeBlock(w.then), LineNo: w.lineNo}
	case "filterInject":
		var val ast.Expression
		if w.injectValue != nil {
			val = decodeExpr(*w.injectValue)
		}
		op := w.injectOp
		if op == "" {
			op = "eq"
		}
		return &ast.FilterInjectStmt{Field: w.injectField, Value: val, Op: op, LineNo: w.lineNo}
	default:
		return &ast.PredicateExpr{Expr: &ast.Literal{Value: true}}
	}
}

func encodeModifyFields(fs []*ast.ModifyAssignment) []modifyFieldWire {
	var out []modifyFieldWire
	for _, f := range fs {
		out = append(out, modifyFieldWire{Field: f.Field, Value: *encodeExpr(f.Value), LineNo: f.LineNo})
	}
	return out
}

func decodeModifyFields(w []modifyFieldWire) []*ast.ModifyAssignment {
	var out []*ast.ModifyAssignment
	for _, f := range w {
		out = append(out, &ast.ModifyAssignment{Field: f.Field, Value: decodeExpr(f.Value), LineNo: f.LineNo})
	}
	return out
}

func encodeExprs(exprs []ast.Expression) []exprWire {
	var out []exprWire
	for _, e := range exprs {
		out = append(out, *encodeExpr(e))
	}
	return out
}

func decodeExprs(w []exprWire) []ast.Expression {
	var out []ast.Expression
	for _, e := range w {
		out = append(out, decodeExpr(e))
	}
	return out
}

func encodeExpr(e ast.Expression) *exprWire {
	if e == nil {
		return nil
	}
	switch v := e.(type) {
	case *ast.Literal:
		return &exprWire{Kind: "literal", literalValue: v.Value, lineNo: v.LineNo}
	case *ast.FieldAccess:
		return &exprWire{Kind: "fieldAccess", object: v.Object, fields: v.Fields, lineNo: v.LineNo}
	case *ast.BinaryOp:
		return &exprWire{Kind: "binary", left: encodeExpr(v.Left), op: v.Op, right: encodeExpr(v.Right), lineNo: v.LineNo}
	case *ast.UnaryOp:
		return &exprWire{Kind: "unary", unaryOp: v.Op, right: encodeExpr(v.Right), lineNo: v.LineNo}
	case *ast.InExpr:
		w := &exprWire{Kind: "in", inLeft: encodeExpr(v.Left), lineNo: v.LineNo}
		for _, item := range v.Values {
			w.inValues = append(w.inValues, *encodeExpr(item))
		}
		return w
	case *ast.ArrayLiteral:
		w := &exprWire{Kind: "array", lineNo: v.LineNo}
		for _, item := range v.Items {
			w.items = append(w.items, *encodeExpr(item))
		}
		return w
	case *ast.ExternalCall:
		p := map[string]exprWire{}
		for k, e := range v.Params {
			x := encodeExpr(e)
			p[k] = *x
		}
		return &exprWire{Kind: "external", extName: v.Name, extParams: p, lineNo: v.LineNo}
	case *ast.BuiltinCall:
		w := &exprWire{Kind: "builtin", builtinName: v.Name, lineNo: v.LineNo}
		for _, a := range v.Args {
			w.builtinArgs = append(w.builtinArgs, *encodeExpr(a))
		}
		return w
	case *ast.ReadQuery:
		return &exprWire{Kind: "read", readModel: v.Model, readFilter: encodeQueryFilter(v.Filter), readLock: v.Lock, readOne: v.One, readSelect: v.Select, lineNo: v.LineNo}
	case *ast.CountQuery:
		return &exprWire{Kind: "count", countModel: v.Model, countFilter: encodeQueryFilter(v.Filter), lineNo: v.LineNo}
	case *ast.SumQuery:
		return &exprWire{Kind: "sum", sumModel: v.Model, sumField: v.Field, sumFilter: encodeQueryFilter(v.Filter), lineNo: v.LineNo}
	case *ast.FieldProjectionExpr:
		w := &exprWire{Kind: "fieldProjection", projectionModel: v.Model, projectionField: v.Field, lineNo: v.LineNo}
		if v.Source != nil {
			w.projectionSource = encodeExpr(v.Source)
		}
		return w
	case *ast.PredicateExpr:
		return encodeExpr(v.Expr)
	default:
		return &exprWire{Kind: "literal", literalValue: nil}
	}
}

func decodeExprPtr(w *exprWire) ast.Expression {
	if w == nil {
		return nil
	}
	return decodeExpr(*w)
}

func decodeExpr(w exprWire) ast.Expression {
	switch w.Kind {
	case "literal":
		return &ast.Literal{Value: w.literalValue, LineNo: w.lineNo}
	case "fieldAccess":
		return &ast.FieldAccess{Object: w.object, Fields: w.fields, LineNo: w.lineNo}
	case "binary":
		var left, right ast.Expression
		if w.left != nil {
			left = decodeExpr(*w.left)
		}
		if w.right != nil {
			right = decodeExpr(*w.right)
		}
		return &ast.BinaryOp{Left: left, Op: w.op, Right: right, LineNo: w.lineNo}
	case "unary":
		var right ast.Expression
		if w.right != nil {
			right = decodeExpr(*w.right)
		}
		return &ast.UnaryOp{Op: w.unaryOp, Right: right, LineNo: w.lineNo}
	case "in":
		var vals []ast.Expression
		for _, item := range w.inValues {
			vals = append(vals, decodeExpr(item))
		}
		var left ast.Expression
		if w.inLeft != nil {
			left = decodeExpr(*w.inLeft)
		}
		return &ast.InExpr{Left: left, Values: vals, LineNo: w.lineNo}
	case "array":
		var items []ast.Expression
		for _, item := range w.items {
			items = append(items, decodeExpr(item))
		}
		return &ast.ArrayLiteral{Items: items, LineNo: w.lineNo}
	case "external":
		p := map[string]ast.Expression{}
		for k, e := range w.extParams {
			p[k] = decodeExpr(e)
		}
		return &ast.ExternalCall{Name: w.extName, Params: p, LineNo: w.lineNo}
	case "builtin":
		var args []ast.Expression
		for _, a := range w.builtinArgs {
			args = append(args, decodeExpr(a))
		}
		return &ast.BuiltinCall{Name: w.builtinName, Args: args, LineNo: w.lineNo}
	case "read":
		return &ast.ReadQuery{Model: w.readModel, Filter: decodeQueryFilter(w.readFilter), Lock: w.readLock, One: w.readOne, Select: w.readSelect, LineNo: w.lineNo}
	case "count":
		return &ast.CountQuery{Model: w.countModel, Filter: decodeQueryFilter(w.countFilter), LineNo: w.lineNo}
	case "sum":
		return &ast.SumQuery{Model: w.sumModel, Field: w.sumField, Filter: decodeQueryFilter(w.sumFilter), LineNo: w.lineNo}
	case "fieldProjection":
		var src ast.Expression
		if w.projectionSource != nil {
			src = decodeExpr(*w.projectionSource)
		}
		return &ast.FieldProjectionExpr{Model: w.projectionModel, Field: w.projectionField, Source: src, LineNo: w.lineNo}
	default:
		return &ast.Literal{Value: nil}
	}
}

func encodeQueryFilter(qf *ast.QueryFilter) *queryFilterWire {
	if qf == nil {
		return nil
	}
	w := &queryFilterWire{}
	for _, ff := range qf.Fields {
		wf := queryFieldFilterWire{Field: ff.Field}
		for _, op := range ff.Ops {
			wo := queryOpWire{Op: op.Op}
			if op.Value != nil {
				e := encodeExpr(op.Value)
				wo.Value = e
			}
			wf.Ops = append(wf.Ops, wo)
		}
		w.Fields = append(w.Fields, wf)
	}
	return w
}

func decodeQueryFilter(w *queryFilterWire) *ast.QueryFilter {
	if w == nil {
		return nil
	}
	qf := &ast.QueryFilter{}
	for _, ff := range w.Fields {
		af := &ast.QueryFieldFilter{Field: ff.Field}
		for _, op := range ff.Ops {
			qo := &ast.QueryOp{Op: op.Op}
			if op.Value != nil {
				qo.Value = decodeExpr(*op.Value)
			}
			af.Ops = append(af.Ops, qo)
		}
		qf.Fields = append(qf.Fields, af)
	}
	return qf
}

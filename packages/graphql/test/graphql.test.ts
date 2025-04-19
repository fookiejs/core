import { defaults, Field, Model, TypeStandartization } from "@fookiejs/core"

@Model.Decorator({
	database: defaults.database.store,
})
export class User extends Model {
	@Field.Decorator({
		type: TypeStandartization.String,
	})
	name!: string

	@Field.Decorator({
		type: TypeStandartization.String,
	})
	email!: string

	@Field.Decorator({
		type: TypeStandartization.Integer,
	})
	height!: number

	@Field.Decorator({
		type: TypeStandartization.Boolean,
		default: true,
	})
	isActive!: boolean
}

@Model.Decorator({
	database: defaults.database.store,
})
export class Company extends Model {
	@Field.Decorator({
		type: TypeStandartization.String,
	})
	name!: string
}

@Model.Decorator({
	database: defaults.database.store,
})
export class Team extends Model {
	@Field.Decorator({
		type: TypeStandartization.String,
	})
	name!: string

	@Field.Decorator({
		relation: Company,
	})
	company!: Company
}

@Model.Decorator({
	database: defaults.database.store,
})
export class UserTeam extends Model {
	@Field.Decorator({
		relation: User,
	})
	user!: User

	@Field.Decorator({
		relation: Team,
	})
	team!: Team
}

@Model.Decorator({
	database: defaults.database.store,
})
export class Meeting extends Model {
	@Field.Decorator({
		relation: User,
	})
	user!: User

	@Field.Decorator({
		relation: Company,
	})
	company!: Company
}

@Model.Decorator({
	database: defaults.database.store,
})
export class TeamMeeting extends Model {
	@Field.Decorator({
		relation: Team,
	})
	team!: Team

	@Field.Decorator({
		relation: Meeting,
	})
	meeting!: Meeting
}

@Model.Decorator({
	database: defaults.database.store,
})
export class UserMeetingAccess extends Model {
	@Field.Decorator({
		relation: User,
	})
	user!: User

	@Field.Decorator({
		relation: Meeting,
	})
	meeting!: Meeting
}

@Model.Decorator({
	database: defaults.database.store,
})
export class MeetingAnalytics extends Model {
	@Field.Decorator({
		relation: Meeting,
	})
	meeting!: Meeting

	@Field.Decorator({
		type: TypeStandartization.String,
	})
	summary!: string

	@Field.Decorator({
		type: TypeStandartization.String,
		isArray: true,
	})
	actionItems!: string[]
}

@Model.Decorator({
	database: defaults.database.store,
})
export class UserPaymentHistory extends Model {
	@Field.Decorator({
		relation: User,
	})
	user!: User

	@Field.Decorator({
		type: TypeStandartization.String,
	})
	paymentMethod!: string

	@Field.Decorator({
		type: TypeStandartization.Integer,
	})
	amount!: number

	@Field.Decorator({
		type: TypeStandartization.Timestamp,
	})
	paymentDate!: Date
}

@Model.Decorator({
	database: defaults.database.store,
})
export class CompanyDocuments extends Model {
	@Field.Decorator({
		relation: Company,
	})
	company!: Company

	@Field.Decorator({
		type: TypeStandartization.String,
	})
	documentType!: string

	@Field.Decorator({
		type: TypeStandartization.String,
	})
	documentUrl!: string
}

enum TestRole {
	ADMIN = "ADMIN",
	USER = "USER",
	GUEST = "GUEST",
}

@Model.Decorator({
	database: defaults.database.store,
})
export class CompanyUserRole extends Model {
	@Field.Decorator({
		relation: Company,
	})
	company!: Company

	@Field.Decorator({
		relation: User,
	})
	user!: User

	@Field.Decorator({
		type: TypeStandartization.Enum,
		enum: TestRole,
	})
	role!: string
}

import { createServer } from "../mod.ts"
import { defaults, Field, Model } from "@fookiejs/core"

@Model.Decorator({
	database: defaults.database.store,
})
export class User extends Model {
	@Field.Decorator({
		type: defaults.type.text,
	})
	name!: string

	@Field.Decorator({
		type: defaults.type.text,
	})
	email!: string

	@Field.Decorator({
		type: defaults.type.integer,
	})
	height!: number

	@Field.Decorator({
		type: defaults.type.boolean,
		default: true,
	})
	isActive!: boolean
}

@Model.Decorator({
	database: defaults.database.store,
})
export class Company extends Model {
	@Field.Decorator({
		type: defaults.type.text,
	})
	name!: string
}

@Model.Decorator({
	database: defaults.database.store,
})
export class Team extends Model {
	@Field.Decorator({
		type: defaults.type.text,
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
		type: defaults.type.text,
	})
	summary!: string

	@Field.Decorator({
		type: defaults.type.array(defaults.type.text),
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
		type: defaults.type.text,
	})
	paymentMethod!: string

	@Field.Decorator({
		type: defaults.type.integer,
	})
	amount!: number

	@Field.Decorator({
		type: defaults.type.timestamp,
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
		type: defaults.type.text,
	})
	documentType!: string

	@Field.Decorator({
		type: defaults.type.text,
	})
	documentUrl!: string
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
		type: defaults.type.text,
	})
	role!: string
}

Deno.test("Graphql", async () => {
	createServer()
})

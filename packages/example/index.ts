import { createContext, createServer } from "@fookiejs/graphql"
import { startStandaloneServer } from "npm:@apollo/server@4.11/standalone"
import { Effect, Lifecycle, Method, Rule } from "@fookiejs/core"
import { defaults, Field, Model } from "@fookiejs/core"
import { initCache } from "@fookiejs/cache"
import * as typeorm from "@fookiejs/typeorm"
import * as pg from "pg"
pg

const cacheModule = initCache(typeorm.database)
const database = typeorm.database
const cacheMixin = cacheModule.createMixin(1 * 60 * 60)
const mixins = [cacheMixin]
const binds = {
	[Method.CREATE]: {
		[Lifecycle.ROLE]: [],
	},
	[Method.READ]: {
		[Lifecycle.ROLE]: [],
	},
	[Method.UPDATE]: {
		[Lifecycle.ROLE]: [],
	},
	[Method.DELETE]: {
		[Lifecycle.ROLE]: [],
	},
}

const userBinds = {
	[Method.CREATE]: {
		[Lifecycle.ROLE]: [],
	},
	[Method.READ]: {
		[Lifecycle.ROLE]: [],
		[Lifecycle.EFFECT]: [Effect.create({
			key: "test",
			execute: async () => {
			},
		})],
	},
	[Method.UPDATE]: {
		[Lifecycle.ROLE]: [],
	},
	[Method.DELETE]: {
		[Lifecycle.ROLE]: [],
	},
}

@Model.Decorator({
	database: database,
	binds: userBinds,
	mixins,
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
		type: defaults.type.float,
	})
	height!: number

	@Field.Decorator({
		type: defaults.type.boolean,
		default: true,
	})
	isActive!: boolean
}

@Model.Decorator({
	database: database,
	binds,
	mixins,
})
export class Company extends Model {
	@Field.Decorator({
		type: defaults.type.text,
	})
	name!: string
}

@Model.Decorator({
	database: database,
	binds,
	mixins,
})
export class Team extends Model {
	@Field.Decorator({
		type: defaults.type.text,
	})
	name!: string

	@Field.Decorator({
		relation: Company,
	})
	company!: string
}

@Model.Decorator({
	database: database,
	binds,
	mixins,
})
export class UserTeam extends Model {
	@Field.Decorator({
		relation: User,
	})
	user!: string

	@Field.Decorator({
		relation: Team,
	})
	team!: string
}

@Model.Decorator({
	database: database,
	binds,
	mixins,
})
export class Meeting extends Model {
	@Field.Decorator({
		type: defaults.type.text,
	})
	name!: string

	@Field.Decorator({
		relation: Company,
	})
	company!: string
}

@Model.Decorator({
	database: database,
	binds,
	mixins,
})
export class TeamMeeting extends Model {
	@Field.Decorator({
		relation: Team,
	})
	team!: string

	@Field.Decorator({
		relation: Meeting,
	})
	meeting!: string
}

@Model.Decorator({
	database: database,
	binds,
	mixins,
})
export class UserMeetingAccess extends Model {
	@Field.Decorator({
		relation: User,
	})
	user!: string

	@Field.Decorator({
		relation: Meeting,
	})
	meeting!: string
}

@Model.Decorator({
	database: database,
	binds,
	mixins,
})
export class MeetingAnalytics extends Model {
	@Field.Decorator({
		relation: Meeting,
	})
	meeting!: string

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
	binds,
	mixins,
})
export class UserPaymentHistory extends Model {
	@Field.Decorator({
		relation: User,
	})
	user!: string

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

const getError = Rule.create({
	key: "company",
	execute: async () => {
		return true
	},
})

@Model.Decorator({
	database: database,
	mixins,
	binds: {
		[Method.CREATE]: {
			[Lifecycle.ROLE]: [],
		},
		[Method.READ]: {
			[Lifecycle.ROLE]: [],
			[Lifecycle.RULE]: [getError],
		},
		[Method.UPDATE]: {
			[Lifecycle.ROLE]: [],
		},
		[Method.DELETE]: {
			[Lifecycle.ROLE]: [],
		},
	},
})
export class CompanyDocuments extends Model {
	@Field.Decorator({
		relation: Company,
	})
	company!: string

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
	database: database,
	binds,
	mixins,
})
export class CompanyUserRole extends Model {
	@Field.Decorator({
		relation: Company,
	})
	company!: string

	@Field.Decorator({
		relation: User,
	})
	user!: string

	@Field.Decorator({
		type: defaults.type.text,
	})
	role!: string
}

await typeorm.initializeDataSource({
	type: "postgres",
	host: "localhost",
	port: 5432,
	username: "postgres",
	password: "postgres",
	database: "mydb",
})

for (let i = 0; i < 20; i++) {
	const company = await Company.create({
		name: `Fookie ${i}`,
	})

	const team = await Team.create({
		name: `Fookie ${i}`,
		company: company.id,
	})

	for (let j = 0; j < 2; j++) {
		const user = await User.create({
			name: `Fookie ${i}`,
			email: `fookie${i}@fookie.com`,
			height: 180.0,
			isActive: true,
		})

		UserTeam.create({
			user: user.id,
			team: team.id,
		})

		const meeting = await Meeting.create({
			name: `Meeting Name Fookie ${i}`,
			company: company.id,
		})

		TeamMeeting.create({
			team: team.id,
			meeting: meeting.id,
		})

		await CompanyDocuments.create({
			company: company.id,
			documentType: "document",
			documentUrl: `https://fookiejs.com/fookie${i}`,
		})
	}
}

const server = createServer()

const { url } = await startStandaloneServer(server, {
	listen: { port: 8000 },
	context: async ({ req }) => createContext(req),
})

console.log(`Server running on: ${url}`)

import { create } from "../src/index.ts"
import { defaults, Field, Model } from "@fookiejs/core"
import { ApolloServer } from "npm:@apollo/server"
import { startStandaloneServer } from "npm:@apollo/server/standalone"

@Model.Decorator({
  database: defaults.database.store,
})
export class User extends Model {
  @Field.Decorator({
    type: defaults.type.string,
  })
  name: string

  @Field.Decorator({
    type: defaults.type.string,
  })
  email: string

  @Field.Decorator({
    type: defaults.type.number,
  })
  height: number

  @Field.Decorator({
    type: defaults.type.boolean,
    default: true,
  })
  isActive: boolean
}

@Model.Decorator({
  database: defaults.database.store,
})
export class Company extends Model {
  @Field.Decorator({
    type: defaults.type.string,
  })
  name: string
}

@Model.Decorator({
  database: defaults.database.store,
})
export class Team extends Model {
  @Field.Decorator({
    type: defaults.type.string,
  })
  name: string

  @Field.Decorator({
    relation: Company,
  })
  company: Company
}

@Model.Decorator({
  database: defaults.database.store,
})
export class UserTeam extends Model {
  @Field.Decorator({
    relation: User,
  })
  user: User

  @Field.Decorator({
    relation: Team,
  })
  team: Team
}

@Model.Decorator({
  database: defaults.database.store,
})
export class Meeting extends Model {
  @Field.Decorator({
    relation: User,
  })
  user: User

  @Field.Decorator({
    relation: Company,
  })
  company: Company
}

@Model.Decorator({
  database: defaults.database.store,
})
export class TeamMeeting extends Model {
  @Field.Decorator({
    relation: Team,
  })
  team: Team

  @Field.Decorator({
    relation: Meeting,
  })
  meeting: Meeting
}

@Model.Decorator({
  database: defaults.database.store,
})
export class UserMeetingAccess extends Model {
  @Field.Decorator({
    relation: User,
  })
  user: User

  @Field.Decorator({
    relation: Meeting,
  })
  meeting: Meeting
}

@Model.Decorator({
  database: defaults.database.store,
})
export class MeetingAnalytics extends Model {
  @Field.Decorator({
    relation: Meeting,
  })
  meeting: Meeting

  @Field.Decorator({
    type: defaults.type.string,
  })
  summary: string

  @Field.Decorator({
    type: defaults.type.array(defaults.type.string),
  })
  actionItems: string[]
}

@Model.Decorator({
  database: defaults.database.store,
})
export class UserPaymentHistory extends Model {
  @Field.Decorator({
    relation: User,
  })
  user: User

  @Field.Decorator({
    type: defaults.type.string,
  })
  paymentMethod: string

  @Field.Decorator({
    type: defaults.type.number,
  })
  amount: number

  @Field.Decorator({
    type: defaults.type.date,
  })
  paymentDate: Date
}

@Model.Decorator({
  database: defaults.database.store,
})
export class CompanyDocuments extends Model {
  @Field.Decorator({
    relation: Company,
  })
  company: Company

  @Field.Decorator({
    type: defaults.type.string,
  })
  documentType: string

  @Field.Decorator({
    type: defaults.type.string,
  })
  documentUrl: string
}

@Model.Decorator({
  database: defaults.database.store,
})
export class CompanyUserRole extends Model {
  @Field.Decorator({
    relation: Company,
  })
  company: Company

  @Field.Decorator({
    relation: User,
  })
  user: User

  @Field.Decorator({
    type: defaults.type.string,
  })
  role: string
}

Deno.test("GraphQL şema oluşturma", () => {
  const schema = create()
  console.log("GraphQL Şeması:")
  console.log(schema.typeDefs)
})

const server = new ApolloServer(create())
startStandaloneServer(server).then((res) => console.log(res))

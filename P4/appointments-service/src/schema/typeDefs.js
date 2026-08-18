// aqui se describe el schema de graphql en su formato de texto normal (sdl)
// esto define que datos existen y que se puede preguntar o cambiar

const { buildSchema } = require("graphql");

const schema = buildSchema(`
  type Appointment {
    id: ID!
    artistId: Int!
    clientId: Int!
    date: String!
    bodyPart: String!
    design: String
    durationMinutes: Int!
    status: String!
    depositAmount: Float
    depositPaid: Boolean!
  }

  type Query {
    appointments: [Appointment!]!
    appointment(id: ID!): Appointment
  }

  type Mutation {
    createAppointment(
      artistId: Int!
      date: String!
      bodyPart: String!
      design: String
      durationMinutes: Int
    ): Appointment

    updateAppointmentStatus(id: ID!, status: String!): Appointment

    registerDeposit(id: ID!, amount: Float!): Appointment
  }
`);

module.exports = schema;
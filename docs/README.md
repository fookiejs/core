# FookieJS Core Documentation

# What is FookieJS?

FookieJS is an extensible Typescript Framework that provides integrated CRUD functionality by defining your
application's data structures with models. With this structure, FookieJS supports fast and consistent application
development while enabling you to implement complex functions with ease.

# Get Started

## Installation

```bash
npm install fookie
```

## **Hello World!**

```javascript
import { Builder, Database, Dictionary, Method, Mixin, Role, run, Type, Types, use } from "fookie"
;(async () => {
  const todo_model = await Builder.model({
    name: "todo",
    database: Database.store,
    schema: {
      title: {
        type: Fookie.Dictionary.type.string,
      },
      status: {
        type: Fookie.Dictionary.type.string,
        default: "Not Started",
      },
    },
    bind: {
      read: {
        role: [Lifecycle.everybody],
      },
      create: {
        role: [Lifecycle.system],
      },
    },
  })

  const todo_entity = await Fookie.run({
    sub: process.env.SYSTEM_TOKEN, // Only "system" role can create a todo.
    model: todo_model,
    method: Method.Create,
    body: {
      title: "Example",
    },
  })
  console.log(todo_entity)

  const todo_response = await Fookie.run({
    model: todo_model,
    method: Method.Read,
    query: {
      filter: {
        title: "Example",
      },
    },
  })

  console.log(todo_response)
})()
/*
todo_entity
{
  data: {
    id: '365c7be01f4d-4254-9d34-5cfeb8800dea',
    title: 'Example',
    status: 'Not Started'
  },
  status: true,
  error: null,
  validation_error: {}
}

todo_response
{
  data: [
    {
      id: '365c7be01f4d-4254-9d34-5cfeb8800dea',
      title: 'Example',
      status: 'Not Started'
    }
  ],
  status: true,
  error: null,
  validation_error: {}
}
*/
```

# **Packages and Modules**

FookieJS makes your application development process simple and effective through integrated packages and modules. These
modules come together to fulfill the basic needs of your application.

## **Core Packages**

### **Builder**

It is the basic building block of your application. It allows you to define models and perform operations on these
models.

### **run**

It allows you to perform CRUD operations on the models you define.

### **Database**

Manages the database operations that FookieJS supports. It simplifies your database connections and queries.

### **Method**

Uygulamanızın temel CRUD işlevlerini tanımlar. Bu, verileriniz üzerindeki işlemleri yönetir.

### **Type**

Defines the basic CRUD functions of your application. This manages operations on your data.

### **Mixin**

It helps you add additional features or functions to your app's models.

### **Role**

Defines authentication and authorization functions. This increases the security level of your application.

### **Dictionary**

It allows you to assign to here like something role, mixin and model

# **Model Creation**

With FookieJS, creating models, the basic building block of your application, is extremely simple. Models define the
data structure of your application and the operations on these structures. In this section, we explain how a model is
defined and its most basic properties.

## **Model Definition and Properties**

Models are the structure that helps your application interact with the database. Each model represents a specific data
structure and contains information about how that structure is stored, how it is queried, etc.

```javascript
import { Builder, Database, Dictionary, Method, Mixin, Role, run, Selection, Type, Types, use } from "fookie"

import { init_cache } from "fookie_cache"
import { init_redis } from "fookie_redis"
;(async () => {
  const database_redis = await init_redis()
  const mixin_cache = await init_cache(database_redis)

  async function positive_integer(val) {
    return val > 0
  }

  const product_model = await Builder.model({
    name: "product",
    database: Database.store,
    mixins: [mixin_cache],
    schema: {
      name: { type: Fookie.Dictionary.type.string },
      stock: {
        type: Fookie.Dictionary.Type.integer,
        validators: [positive_integer],
      },
      color: { type: Fookie.Dictionary.Type.integer },
    },
    bind: {
      read: {
        role: [Lifecycle.everybody],
      },
    },
  })
})()
```

## **Defination of Model Fields**

| key      | description                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------- |
| name     | Defines the unique name of the model. This name is used to refer to the model in other operations.              |
| database | Determines in which database storage solution the model will be stored.                                         |
| schema   | Defines the data structure of the model and its properties.                                                     |
| bind     | Defines the operations that can be performed on the model and how to handle these operations.                   |
| mixins   | It is used to add additional features to the functionality of the model, so you can create reusable structures. |

## **Schema**

Fields are used to define how each field in the model behaves. Here are some properties that can be used in this fielder

| key | description | | -------------- | ------------------------------------------------------------- |
----------------------------- | | type | Specifies which data type the field is. | | required | Indicates whether the
field is mandatory or not. | | unique | Indicates whether the field is unique or not. | | default | Indicates the
default value for the field. | | unique_group | Specifies the uniqueness groups. | | relation | Specifies the
relationship with other models. | | read | Specifies which roles can read the information in this field. | | write |
Information in this field specifies which roles can write. | | minimum | Specifies minimum limits for numeric values. |
| maximum | Specifies maximum limits for numeric values. | | minimum_size | Specifies size limits for arrays. | |
maximum_size | Specifies size limits for arrays. | | selection | specifies a specific type of selection. | | validators
| Specifies special validators. | specifies whether it is null. |

## **Bind**

This defines how the methods of a model work. It can be written separately for each method. Below is an example for
create.

| lifecycle | description                                                                        |
| --------- | ---------------------------------------------------------------------------------- |
| pre_rule  | Specifies the first rules to be executed before the method is called.              |
| modify    | Specifies functions to modify incoming data.                                       |
| role      | specifies which roles can call this method.                                        |
| rule      | Specifies the conditions for processing or saving data.                            |
| filter    | Specifies functions to filter the returned data.                                   |
| effect    | Specifies side effect functions to be executed after the method completes.         |
| accept    | Specifies modify and rules to be added to the flow when a role is accepted.        |
| reject    | Specifies modifications and rules to be added to the flow when a role is rejected. |

### A Deep Dive into the Concept of Bind and Role

### Bind

The **`bind`** concept allows you to control operations (such as CRUD operations) performed on a specific model. For
example, it specifies which roles can read, update, create or delete a model.

### Role

**`role`** represents the authorization of users or systems to perform certain operations. For example,
**`Lifecycle.everybody`** gives access to all users, while **`Lifecycle.nobody`** gives access to no users.

### \***\*Lifecycle, Reject ve Accept\*\***

The **`lifecycle`** specifies special functions to be executed during the operation performed on a model.

\***\*Reject ve Accept\*\*** For each model operation, **`reject`** and **`accept`** are used to accept or reject
specific roles.

- **Reject**: Used to reject the operation. If **`reject`** is defined for a role and a user with that role tries to
  perform the specified operation, the operation will be rejected.
- **Accept**: Used to accept the operation. If **`accept`** is defined for a role and a user with that role attempts to
  perform the specified operation, the operation is accepted.

The **`lifecycle`** functions you specify in **`reject`** and **`accept`** are used to determine whether a transaction
is rejected or accepted.

### Example

```javascript
import {
    Dictionary,
    Builder,
    Database,
    Method,
    Mixin,
    Role,
    Selection,
    Type,
    Types,
    use,
    run,
} from "fookie";
import * as lodash from "https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js";
;
(async () => {
    const set_draft = Builder.lifecycle(async function set_draft(payload, state) {
        if (!payload.body.status) {
            payload.body.status = "draft";
        }
    });

    const set_limit = Builder.lifecycle(async function set_limit(payload, state) {
        payload.query.limit = 10;
    });

    const set_published: Types.LifecycleFunction<unknown, any> = async function set_published(
        payload,
        state,
    ) {
        payload.query.filter.status = "published";
    };

    const valide_article_status: Types.LifecycleFunction = async function valide_article_status(
        payload,
        state,
    ) {
        return lodash.includes(["draft", "published"], payload.body.status);
    };

    const ArticleModel = await Builder.model({
        name: "article",
        database: Database.store,
        schema: {
            title: { type: Fookie.Dictionary.type.string },
            content: { type: Fookie.Dictionary.type.string },
            status: { type: Fookie.Dictionary.type.string },
        },
        bind: {
            read: {
                role: [Lifecycle.system, Lifecycle.everybody],
                reject: {
                    system: {
                        modify: [set_limit, set_published],
                    },
                },
            },
            create: {
                pre_rule: [],
                rule: [valide_article_status],
                modify: [set_draft],
                role: [Lifecycle.system],
                filter: [],
                effect: [],
            },
        },
    });

    for (let i = 0; i < 100; i++) {
        await Fookie.run({
            sub: process.env.SYSTEM_TOKEN,
            model: ArticleModel,
            method: Method.Create,
            body: {
                title: `Title ${i}`,
                content: `content ${i}`,
                status: Math.random() > 0.5 ? "draft" : "published",
            },
        });
    }

    const response_1 = await Fookie.run({
        model: ArticleModel,
        method: Method.Read,
        query: {},
    });

    console.log("As a 'everybody' article data length" + response_1.data.length);
    console.log(
        "As a 'everybody' published article data length " +
            lodash.filter(response_1.data, { status: "published" }).length,
    );

    const response_2 = await Fookie.run({
        sub: process.env.SYSTEM_TOKEN, // system token
        model: ArticleModel,
        method: Method.Read,
        query: {},
    });

    console.log("As a 'system' article data length" + response_2.data.length);
    console.log(
        "As a 'system' published article data length " +
            lodash.filter(response_2.data, { status: "published" }).length,
    );
})();
```

## **Methods**

| name   | description                                                                                                                              | returning data |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Create | This method is used to create a new record. It adds this data to the database by sending data according to the model schema you specify. | Entity         |
| Read   | Used to read existing records. You can access specific data using specific filters or queries.                                           | Entity[]       |
| Update | Used to update the data in an existing record. You can identify the record using a specific ID or filter and make the desired changes.   | Boolean        |
| Delete | Used to delete an existing record. You can identify and delete the record using a specific ID or filter.                                 | Boolean        |
| Sum    | Allows you to get the sum value over a specific property or properties. Especially useful on numeric data.                               | Float          |
| Test   | Allows you to test how your model handles a specific method or function. This is useful for verifying functionality during development.  | Response       |

# **Data Types**

The basic data types you can use in FookieJS are critical for defining the structure of your data in the database. Here
are some key data types you can define and their brief descriptions

## **Core Data Types**

## | name | description | | --------- |

| ---------------------------------------------------------------------------------------------- | | Text | Used for
text data. This accepts any string of characters, such as characters of the alphabet, numbers and special characters. |
| Float | Accepts floating point numbers. | | | Integer | Accepts only integers. | | | Boolean | Accepts true or false
values. | | | Buffer | Accepts a data buffer (Buffer). Especially used for storing binary data such as file contents. |
| Plain | Accepts simple objects. | | Char | Accepts only a single character. | | Function | Accepts functions. | | |
Array | Accepts an array of data of a specific type. | | DateType | Accepts only dates in 'YYYY-MM-DD' format. | | Time
| Accepts time values containing hours, minutes and seconds. | | DateTime | Accepts timestamp values that contain both
date and time information. | | Timestamp | Accepts timestamp values. |

# Query and Response Structure

## **Run Function and Usage**

In FookieJS, the **`run`** function allows to execute a specific method on a model. This function facilitates the
implementation of CRUD operations (Create, Read, Update, Delete) as well as other specialized methods. Basically, the
**`run`** function is the trigger for a model to perform a specific operation.

```javascript
import { Dictionary, Method, run } from "fookie"

const response = await Fookie.run({
  sub: "some string token",
  model: Dictionary.Model.user,
  method: Method.Update,
  query: {
    limit: 10,
    offset: 1,
    filter: {
      email: {
        eq: "foo@example-domain.com",
      },
    },
  },
  body: {
    email: "bar@example-domain.com",
  },
})
```

# Error Management

In a software application, unexpected situations and errors are inevitable. FookieJS has an effective error handling
mechanism to manage such situations. Thanks to this mechanism, errors are reported to both the developer and the users
of the application with meaningful and informative messages.

## Standard Errors

FookieJS throws error messages for many common error conditions.

```javascript
const response = await Fookie.run({
  model: Dictionary.Model.NOT_EXISTED_MODEL,
  method: Method.Read,
  query: {},
})
console.log(response)
/*
{
  data: null,
  status: false,
  error: 'has_model',
  validation_error: {}
}
*/
```

## **Validation Errors**

FookieJS provides a specific set of types and rules for the fields defined on the models. When data is entered that does
not comply with these rules, the system automatically throws a validation error.

```javascript
import { Builder, Database, Dictionary, Method, Mixin, Role, run, Selection, Type, Types, use } from "fookie"
;(async () => {
  async function is_strong_password(password) {
    var hasLowerCase = /[a-z]/.test(password)
    var hasUpperCase = /[A-Z]/.test(password)
    var hasNumbers = /\d/.test(password)
    var hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password)

    return (
      password.length >= 8 && hasLowerCase && hasUpperCase && hasNumbers && hasSpecialChars
    )
  }

  async function is_email(email) {
    var regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/
    return regex.test(email)
  }

  const account = await Builder.model({
    name: "account",
    database: Database.store,
    schema: {
      email: {
        type: Fookie.Dictionary.type.string,
        validators: [is_email],
      },
      password: {
        type: Fookie.Dictionary.type.string,
        validators: [is_strong_password],
      },
    },
    bind: {
      create: {
        role: [Lifecycle.everybody],
      },
    },
  })

  const response = await Fookie.run({
    model: account,
    method: Method.Create,
    body: {
      email: "test",
      password: "123456",
    },
  })
  console.log(response)

  /*
{
    data: null,
    status: false,
    error: "validate_body",
    validation_error: {
			email: ["is_email"],
			password: ["is_strong_password"]
		},
  }
  */
})()
```

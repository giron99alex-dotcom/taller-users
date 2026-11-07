import { withCORS } from "../common/cors";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";

type UserRole = "buyer" | "seller";

interface User {
  userId: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

function response(
  statusCode: number,
  data: Record<string, unknown>
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  };
}

const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body ?? "{}");

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const role: UserRole = body.role === "seller" ? "seller" : "buyer";

    if (!email || !password || !name) {
      return response(400, {
        message: "El email, password y name son requeridos para el registro.",
      });
    }

    const usersTable = process.env.USERS_TABLE;

    if (!usersTable) {
      throw new Error("No está configurada la variable USERS_TABLE.");
    }

    const existingUsers = await dynamo.send(
      new QueryCommand({
        TableName: usersTable,
        IndexName: "email-index",
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email,
        },
      })
    );

    if (existingUsers.Items && existingUsers.Items.length > 0) {
      return response(400, {
        message: "Ese email ya está registrado.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const user: User = {
      userId: randomUUID(),
      email,
      password: hashedPassword,
      name,
      role,
      createdAt: now,
      updatedAt: now,
    };

    await dynamo.send(
      new PutCommand({
        TableName: usersTable,
        Item: user,
      })
    );

    const { password: _hiddenPassword, ...publicUser } = user;

    return response(200, {
      message: "Usuario creado.",
      user: publicUser,
    });
  } catch (error) {
    console.error("Error al registrar el usuario:", error);

    return response(500, {
      message: "Ocurrió un error al registrar el usuario.",
    });
  }
};

export const register = withCORS(handler);

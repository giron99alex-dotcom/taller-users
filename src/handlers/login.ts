import { withCORS } from "../common/cors";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import * as bcrypt from "bcryptjs";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../lib/jwt";

interface User {
  userId: string;
  email: string;
  password: string;
  name: string;
  role: "buyer" | "seller";
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

    if (!email || !password) {
      return response(400, {
        message: "El email y la contraseña son requeridos.",
      });
    }

    const usersTable = process.env.USERS_TABLE;
    const refreshTable = process.env.JWT_REFRESH_TABLE;

    if (!usersTable || !refreshTable) {
      throw new Error("Falta configurar una tabla en las variables de entorno.");
    }

    const result = await dynamo.send(
      new QueryCommand({
        TableName: usersTable,
        IndexName: "email-index",
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email,
        },
      })
    );

    const user = result.Items?.[0] as User | undefined;

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return response(401, {
        message: "Email o contraseña incorrectos.",
      });
    }

    const tokenPayload = {
      userId: user.userId,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

    await dynamo.send(
      new PutCommand({
        TableName: refreshTable,
        Item: {
          token: refreshToken,
          userId: user.userId,
          expiresAt,
        },
      })
    );

    return response(200, {
      message: "Inicio de sesión exitoso.",
      accessToken,
      refreshToken,
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error al iniciar sesión:", error);

    return response(500, {
      message: "Ocurrió un error al iniciar sesión.",
    });
  }
};

export const login = withCORS(handler);

import { withCORS } from "../common/cors";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";

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
    const userId = event.pathParameters?.id;
    const usersTable = process.env.USERS_TABLE;

    if (!userId) {
      return response(400, { message: "Falta el id del usuario." });
    }

    if (!usersTable) {
      throw new Error("No está configurada la variable USERS_TABLE.");
    }

    const result = await dynamo.send(
      new GetCommand({
        TableName: usersTable,
        Key: { userId },
      })
    );

    if (!result.Item) {
      return response(404, { message: "No se encontró el usuario." });
    }

    const { password: _hiddenPassword, ...publicUser } = result.Item;

    return response(200, {
      message: "Usuario encontrado.",
      user: publicUser,
    });
  } catch (error) {
    console.error("Error al obtener el usuario:", error);

    return response(500, {
      message: "Ocurrió un error al obtener el usuario.",
    });
  }
};

export const getUser = withCORS(handler);

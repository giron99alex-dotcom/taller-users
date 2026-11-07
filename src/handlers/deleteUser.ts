import { withCORS } from "../common/cors";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
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
    const authenticatedUserId = event.requestContext.authorizer?.userId;
    const usersTable = process.env.USERS_TABLE;

    if (!userId) {
      return response(400, { message: "Falta el ID del usuario." });
    }

    if (authenticatedUserId !== userId) {
      return response(403, { message: "No tienes permiso para borrar este usuario." });
    }

    if (!usersTable) {
      throw new Error("No está configurada la variable USERS_TABLE.");
    }

    const result = await dynamo.send(
      new DeleteCommand({
        TableName: usersTable,
        Key: { userId },
        ReturnValues: "ALL_OLD",
      })
    );

    if (!result.Attributes) {
      return response(404, { message: "No se encontró el usuario." });
    }

    return response(200, {
      message: "Usuario eliminado.",
      userId,
    });
  } catch (error) {
    console.error("Error al eliminar el usuario:", error);

    return response(500, {
      message: "Ocurrió un error al eliminar el usuario.",
    });
  }
};

export const deleteUser = withCORS(handler);

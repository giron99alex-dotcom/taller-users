import { withCORS } from "../common/cors";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
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
    const callerId = event.requestContext.authorizer?.userId as
      | string
      | undefined;
    const body = JSON.parse(event.body ?? "{}");
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const usersTable = process.env.USERS_TABLE;

    if (!userId) {
      return response(400, { message: "Falta el id del usuario." });
    }

    if (!callerId || callerId !== userId) {
      return response(403, { message: "No tienes permiso para actualizar este usuario." });
    }

    if (!name) {
      return response(400, { message: "El nombre es requerido." });
    }

    if (!usersTable) {
      throw new Error("No está configurada la variable USERS_TABLE.");
    }

    const result = await dynamo.send(
      new UpdateCommand({
        TableName: usersTable,
        Key: { userId },
        UpdateExpression: "SET #name = :name, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
          "#name": "name",
        },
        ExpressionAttributeValues: {
          ":name": name,
          ":updatedAt": new Date().toISOString(),
        },
        ReturnValues: "ALL_NEW",
      })
    );

    const { password: _hiddenPassword, ...publicUser } = result.Attributes ?? {};

    return response(200, {
      message: "Usuario actualizado.",
      user: publicUser,
    });
  } catch (error) {
    console.error("Error al actualizar el usuario:", error);

    return response(500, {
      message: "Ocurrió un error al actualizar el usuario.",
    });
  }
};

export const updateUser = withCORS(handler);

import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { create, createFileRegistry } from "@bufbuild/protobuf";
import {
  FieldDescriptorProto_Label,
  FieldDescriptorProto_Type,
  FileDescriptorProtoSchema,
} from "@bufbuild/protobuf/wkt/google/protobuf/descriptor_pb.js";

const file = create(FileDescriptorProtoSchema, {
  name: "connect-client-test.proto",
  package: "exa.api_server_pb",
  syntax: "proto3",
  messageType: [
    {
      name: "GetChatMessageRequest",
    },
    {
      name: "GetChatMessageResponse",
      field: [
        { name: "message_id", number: 1, label: FieldDescriptorProto_Label.OPTIONAL, type: FieldDescriptorProto_Type.STRING },
        { name: "delta_text", number: 3, label: FieldDescriptorProto_Label.OPTIONAL, type: FieldDescriptorProto_Type.STRING },
        { name: "stop_reason", number: 5, label: FieldDescriptorProto_Label.OPTIONAL, type: FieldDescriptorProto_Type.INT32 },
      ],
    },
  ],
  service: [
    {
      name: "ApiServerService",
      method: [
        {
          name: "GetChatMessage",
          inputType: ".exa.api_server_pb.GetChatMessageRequest",
          outputType: ".exa.api_server_pb.GetChatMessageResponse",
          serverStreaming: true,
        },
      ],
    },
  ],
});

const service = createFileRegistry(file, () => undefined).getService("exa.api_server_pb.ApiServerService");
if (!service) throw new Error("Test service descriptor not found");

const transport = createConnectTransport({
  baseUrl: "http://127.0.0.1:20130",
  httpVersion: "1.1",
});

const client = createClient(service, transport);
for await (const message of client.getChatMessage({})) {
  console.log(JSON.stringify({
    messageId: message.messageId,
    deltaText: message.deltaText,
    stopReason: message.stopReason,
  }));
}

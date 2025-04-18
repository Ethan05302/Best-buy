const Fastify = require("fastify");
const amqp = require("@azure/service-bus");
const { v4: uuidv4 } = require("uuid");

const app = Fastify();

const connectionString = process.env.SERVICEBUS_CONNECTION;
const queueName = process.env.ORDER_QUEUE_NAME || "orders";

let sender;

// ✅ 启动服务函数
const start = async () => {
  try {
    // ✅ 在启动前同步加载 cors 插件
    const cors = await import("@fastify/cors");
    app.register(cors.default);

    // ✅ 初始化 Service Bus sender
    if (connectionString) {
      const sbClient = new amqp.ServiceBusClient(connectionString);
      sender = sbClient.createSender(queueName);
      console.log("✅ Azure Service Bus sender is ready.");
    } else {
      console.warn("❌ SERVICEBUS_CONNECTION is not set. Exiting sender setup.");
    }

    const address = process.env.FASTIFY_ADDRESS || "0.0.0.0";
    const port = process.env.PORT || 3000;

    await app.listen({ port, host: address });
    console.log(`🚀 Server listening on ${address}:${port}`);
  } catch (err) {
    console.error("❌ Fastify failed to start:", err);
    process.exit(1);
  }
};

// ✅ 发送订单到队列
async function sendMessage(order) {
  if (!sender) {
    console.warn("⚠️ Sender not ready. Message not sent.");
    return;
  }

  const message = {
    body: order,
    contentType: "application/json",
  };

  try {
    await sender.sendMessages(message);
    console.log("✅ Order sent to queue successfully.");
  } catch (err) {
    console.error("❌ Failed to send message to queue:", err);
  }
}

// ✅ 接收订单 POST 路由
app.post("/", async (req, res) => {
  try {
    const items = req.body.items.map(item => ({
      productId: parseInt(item.productId, 10),
      quantity: item.quantity
    }));

    const order = {
      orderId: uuidv4(),
      customer: req.body.customer,
      items
    };

    await sendMessage(order);
    res.status(201).send({ message: "Order sent to queue", order });
  } catch (err) {
    console.error("❌ Failed to handle order:", err);
    res.status(500).send({ error: "Failed to process order" });
  }
});

// ✅ 测试 GET 接口
app.get("/s", async (req, res) => {
  res.send({ status: "Order service is up!" });
});

// ✅ 启动服务
start();

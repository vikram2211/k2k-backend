import mqtt from 'mqtt';
import dotenv from 'dotenv';
import Scan from '../models/Scan';
import { Server } from 'socket.io';

dotenv.config();

const initializeMQTT =async(req,res) => {
  const client = mqtt.connect(process.env.MQTT_BROKER);

  client.on('connect', () => {
    console.log('Connected to MQTT broker');
    client.subscribe('factory/tray/scan', (err) => {
      if (err) console.error('Subscription error:', err);
    });
  });

  client.on('message', async (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      const scan = new Scan({
        count: data.count,
        productId: data.productId,
        timestamp: new Date(data.timestamp),
      });
      await scan.save();
      io.emit('product_scan', scan); // Broadcast to frontend
      console.log('Scan saved and broadcasted:', scan);
    } catch (error) {
      console.error('Error processing MQTT message:', error);
    }
  });

  client.on('error', (err) => {
    console.error('MQTT error:', err);
  });
};

export default initializeMQTT;
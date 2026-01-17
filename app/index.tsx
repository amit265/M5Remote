import RemoteButton from "@/components/RemoteButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Buffer } from "buffer";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  PanResponder,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function App() {
  const [ws, setWs] = useState(null);
  const [mouseVisible, setMouseVisible] = useState(false);
  const [numVisible, setNumVisible] = useState(false);
  const lastTouch = useRef({ x: 0, y: 0 });
  const [isPairing, setIsPairing] = useState(false);
  const reconnecting = useRef(false);
  const pairingInProgress = useRef(false);
  const awaitingApproval = useRef(false);

  const TV_IP = "192.168.1.9";

  useEffect(() => {
    connect();
  }, []);

  const connect = async () => {
    if (reconnecting.current) return;
    reconnecting.current = true;

    try {
      const savedToken = await AsyncStorage.getItem("tv_token");
      const encodedName = Buffer.from("MobileRemote").toString("base64");
      // Use a simpler ID as well
      const encodedID = Buffer.from("M5-Remote-1").toString("base64");
      // Switch to ws:// and 8001 to bypass SSL certificate issues
      let url = `ws://${TV_IP}:8001/api/v2/channels/samsung.remote.control?name=${encodedName}`;

      if (savedToken) {
        url += `&token=${savedToken}`;
      }

      console.log("🔗 Attempting Connection:", url);
      const socket = new WebSocket(url);
      let heartbeatInterval;

      socket.onopen = () => {
        console.log("✅ Connected to TV");
        reconnecting.current = false;
        setWs(socket);
      };

      socket.onmessage = async (e) => {
        const res = JSON.parse(e.data);

        if (res.event === "ms.channel.connect") {
          if (res.data?.token) {
            await AsyncStorage.setItem("tv_token", res.data.token);
            console.log("🎉 Pairing Complete & Token Saved");
          }
          setIsPairing(false);
          // Start Heartbeat only after confirmed connection
          heartbeatInterval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(
                JSON.stringify({
                  method: "ms.remote.control",
                  params: {
                    Cmd: "Move",
                    Position: { x: 0, y: 0 },
                    TypeOfRemote: "ProcessMouseDevice",
                  },
                }),
              );
            }
          }, 4000); // 4 seconds is safer
        }

        if (res.event === "ms.channel.unauthorized") {
          console.log("📺 Action Required: Grant permission on TV screen");
          setIsPairing(true);
        }
      };

      socket.onerror = (err) => {
        // If we are awaiting approval, don't log this as a scary error
        if (!isPairing) {
          console.log("❌ Socket Error: Check network or if TV is awake.");
        }
      };

      socket.onclose = () => {
        console.log(
          "🔌 Connection closed (this is normal during pairing or sleep)",
        );
        clearInterval(heartbeatInterval);
        reconnecting.current = false;

        // If the user hasn't approved yet, keep trying frequently
        // If we are already connected/paired, we can slow down the retry
        const retryTime = isPairing ? 3000 : 5000;
        setTimeout(connect, retryTime);
      };
    } catch (err) {
      console.log("❌ Setup error:", err);
      reconnecting.current = false;
    }
  };
  // ✅ FIXED: matches how you already call it everywhere
  const act = (type, payload) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log("📡 Reconnecting...");
      connect();
      return;
    }

    let msg;

    if (type === "key") {
      msg = {
        method: "ms.remote.control",
        params: {
          Cmd: "Click",
          DataOfCmd: payload,
          Option: "false",
          TypeOfRemote: "SendRemoteKey",
        },
      };
    }

    if (type === "mouse") {
      msg = {
        method: "ms.remote.control",
        params: {
          Cmd: "Move",
          Position: payload,
          TypeOfRemote: "ProcessMouseDevice",
        },
      };
    }

    ws.send(JSON.stringify(msg));
  };

  // Touchpad Handler (unchanged behavior)
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      lastTouch.current = {
        x: evt.nativeEvent.locationX,
        y: evt.nativeEvent.locationY,
      };
    },
    onPanResponderMove: (evt, gestureState) => {
      const dx = Math.round(gestureState.dx / 2);
      const dy = Math.round(gestureState.dy / 2);
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        act("mouse", { x: dx, y: dy });
      }
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
        act("key", "KEY_ENTER");
      }
    },
  });

  return (
    <LinearGradient
      colors={["#020617", "#1e1b4b", "#0f172a"]}
      style={styles.container}
    >
      <StatusBar style="light" translucent />
      <Text style={styles.header}>M5 SMART MONITOR</Text>

      {/* Main Rows */}
      <View style={styles.row}>
        <RemoteButton
          label="OFF"
          onPress={() => act("key", "KEY_POWER")}
          style={styles.btnPower}
        />
        <RemoteButton label="1 2 3" onPress={() => setNumVisible(true)} />
        <RemoteButton label="HOME" onPress={() => act("key", "KEY_HOME")} />
      </View>

      <View style={styles.row}>
        <RemoteButton label="VOL -" onPress={() => act("key", "KEY_VOLDOWN")} />
        <RemoteButton
          label="MUTE"
          onPress={() => act("key", "KEY_MUTE")}
          style={styles.btnNav}
        />
        <RemoteButton label="VOL +" onPress={() => act("key", "KEY_VOLUP")} />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Quick Launch</Text>
        <View style={styles.row}>
          <RemoteButton
            label="NET20"
            onPress={() => act("key", "KEY_WWW")}
            style={styles.btnSuccess}
          />
          <RemoteButton
            label="YOUTUBE"
            onPress={() => act("key", "KEY_YOUTUBE")}
          />
          <RemoteButton
            label="MOUSE 🖱️"
            onPress={() => setMouseVisible(true)}
          />
        </View>
      </View>

      {/* D-PAD */}
      <View style={styles.dpad}>
        <View style={styles.row}>
          <View />
          <RemoteButton
            label="▲"
            onPress={() => act("key", "KEY_UP")}
            style={styles.btnNav}
          />
          <View />
        </View>
        <View style={styles.row}>
          <RemoteButton
            label="◀"
            onPress={() => act("key", "KEY_LEFT")}
            style={styles.btnNav}
          />
          <RemoteButton
            label="OK"
            onPress={() => act("key", "KEY_ENTER")}
            style={styles.okCenter}
          />
          <RemoteButton
            label="▶"
            onPress={() => act("key", "KEY_RIGHT")}
            style={styles.btnNav}
          />
        </View>
        <View style={styles.row}>
          <RemoteButton
            label="BACK"
            onPress={() => act("key", "KEY_RETURN")}
            style={styles.btnNav}
          />
          <RemoteButton
            label="▼"
            onPress={() => act("key", "KEY_DOWN")}
            style={styles.btnNav}
          />
          <RemoteButton
            label="EXIT"
            onPress={() => act("key", "KEY_EXIT")}
            style={styles.btnNav}
          />
        </View>
      </View>

      {/* MOUSE OVERLAY */}
      <Modal visible={mouseVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <TouchableOpacity onPress={() => setMouseVisible(false)}>
            <Text style={styles.closeX}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Directional Control</Text>

          <View style={styles.touchpad} {...panResponder.panHandlers}>
            <Text style={{ color: "#475569" }}>SENSITIVE TRACKPAD</Text>
          </View>
        </View>
      </Modal>

      {/* NUM OVERLAY */}
      <Modal visible={numVisible} animationType="fade" transparent>
        <View style={styles.overlay}>
          <TouchableOpacity onPress={() => setNumVisible(false)}>
            <Text style={styles.closeX}>✕ CLOSE</Text>
          </TouchableOpacity>
          <View style={styles.row}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
              <RemoteButton
                key={n}
                label={n.toString()}
                onPress={() => act("key", `KEY_${n}`)}
              />
            ))}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 25,
    justifyContent: "space-around",
    alignItems: "center",
  },
  header: { color: "#64748b", letterSpacing: 4, fontSize: 10, marginTop: 40 },
  row: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    justifyContent: "center",
  },
  button: {
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    flex: 1,
    paddingVertical: 20,
    borderRadius: 24,
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
  },
  buttonText: { color: "white", fontWeight: "600", fontSize: 14 },
  btnPower: { borderColor: "#ef4444" },
  btnSuccess: { borderColor: "#10b981" },
  btnNav: { backgroundColor: "rgba(51, 65, 85, 0.9)" },
  btnMouse: { backgroundColor: "#22c55e" },
  okCenter: { backgroundColor: "#3b82f6", borderRadius: 50 },
  section: { width: "100%", gap: 10 },
  label: {
    color: "#475569",
    fontSize: 10,
    textAlign: "center",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  dpad: { width: "100%", gap: 10 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.98)",
    padding: 30,
    justifyContent: "center",
    gap: 20,
  },
  closeX: {
    color: "#ef4444",
    fontSize: 32,
    textAlign: "center",
    marginBottom: 20,
  },
  touchpad: {
    width: "100%",
    height: "30%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 30,
    borderColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

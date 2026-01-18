// SIMPLE WEBVIEW REMOTE
import RemoteButton from "@/components/RemoteButton";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import { StatusBar, StyleSheet, Text, View, Modal, TouchableOpacity, PanResponder } from "react-native";
import { WebView } from "react-native-webview";

const TV_IP = "192.168.1.9";
const MY_TOKEN = "17447402"; 
const FIXED_ID = "MyPhoneRemote"; 
const APP_NAME_BASE64 = "UmVtb3Rl";

export default function App() {
  const webViewRef = useRef(null);
  const [status, setStatus] = useState("Initializing...");
  
  // This HTML will run inside the app using the XML security config you added
  const remoteHTML = `
    <!DOCTYPE html>
    <html>
      <body>
        <script>
          const url = "wss://${TV_IP}:8002/api/v2/channels/samsung.remote.control?name=${APP_NAME_BASE64}&id=${FIXED_ID}&token=${MY_TOKEN}";
          let socket;
          
          function connect() {
             window.ReactNativeWebView.postMessage(JSON.stringify({msg: 'Connecting...'}));
             socket = new WebSocket(url);
             
             socket.onopen = () => window.ReactNativeWebView.postMessage(JSON.stringify({msg: 'CONNECTED 🟢'}));
             socket.onmessage = (e) => {
                 const d = JSON.parse(e.data);
                 if(d.event === 'ms.channel.connect') window.ReactNativeWebView.postMessage(JSON.stringify({msg: 'PAIRED 🎉'}));
             };
             socket.onclose = () => {
                 window.ReactNativeWebView.postMessage(JSON.stringify({msg: 'CLOSED (Retrying)'}));
                 setTimeout(connect, 3000);
             };
             socket.onerror = () => window.ReactNativeWebView.postMessage(JSON.stringify({msg: 'SSL ERROR'}));
          }

          document.addEventListener("message", (e) => {
             const p = JSON.parse(e.data);
             if(socket && socket.readyState === 1) {
                 let m;
                 if(p.t === 'k') m = { method:"ms.remote.control", params:{ Cmd:"Click", DataOfCmd:p.v, Option:"false", TypeOfRemote:"SendRemoteKey" } };
                 socket.send(JSON.stringify(m));
             }
          });
          connect();
        </script>
      </body>
    </html>
  `;

  const act = (k) => webViewRef.current?.postMessage(JSON.stringify({t:'k', v:k}));

  return (
    <LinearGradient colors={["#000", "#111"]} style={{flex:1, padding:20, alignItems:'center', justifyContent:'center'}}>
      <StatusBar style="light" />
      
      {/* Invisible WebView */}
      <View style={{height:0, width:0}}>
        <WebView 
          ref={webViewRef}
          source={{ html: remoteHTML, baseUrl: '' }} // baseUrl is key for XML config
          onMessage={(e) => setStatus(JSON.parse(e.nativeEvent.data).msg)}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>

      <Text style={{color:'yellow', marginBottom:20, fontWeight:'bold'}}>STATUS: {status}</Text>

      <RemoteButton label="VOL +" onPress={() => act("KEY_VOLUP")} />
      <RemoteButton label="VOL -" onPress={() => act("KEY_VOLDOWN")} />
      <RemoteButton label="HOME" onPress={() => act("KEY_HOME")} />
      
    </LinearGradient>
  );
}
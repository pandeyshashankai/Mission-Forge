import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import {localData} from "./persistence/localData";

const root=ReactDOM.createRoot(document.getElementById("root"));
root.render(<p role="status" style={{padding:24}}>Opening local mission data…</p>);
localData.ready().then(()=>import("./App")).then(({default:App})=>root.render(<React.StrictMode><App/></React.StrictMode>)).catch(error=>root.render(<main style={{padding:24}}><h1>Mission Forge could not start</h1><p>{error.message}</p><button onClick={()=>window.location.reload()}>Retry</button></main>));

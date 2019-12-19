import "core-js/es/reflect";
import "hammerjs";
import "zone.js/dist/zone";
import "./style.global.scss";

import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
import { AppModule } from "./app/app.module";
import { MatInkBar } from "@angular/material";

const main = async ()=>{
    if (process.env.NODE_ENV === "production") {
        enableProdMode();
    } else {
        console.log("waiting for 10000 milliseconds!")
       // await new Promise(r => setTimeout(r, 10000));
    }
    console.log("HALDO!!!!!!!!!!")
    
    platformBrowserDynamic().bootstrapModule(AppModule);    
}

main().catch((error)=>{ console.error(error);})
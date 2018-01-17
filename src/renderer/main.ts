import 'core-js/es7/reflect';
import 'zone.js/dist/zone';
import 'hammerjs';
import 'web-animations-js';

import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { MainModule } from './main.module';

import './styles/preload.global.scss';
import './styles/theme.global.scss';
import './styles/fonts.global.scss';
import './styles/postload.global.scss';

if (process.env.NODE_ENV === 'production')
    enableProdMode();

platformBrowserDynamic().bootstrapModule(MainModule);
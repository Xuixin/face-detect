import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';

import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';

const myPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fcf9f6',
      100: '#f8f2eb',
      200: '#f0e4d6',
      300: '#e6d1b8',
      400: '#d9ba93',
      500: '#c69c6d', // --primary: oklch(0.705 0.213 47.604)
      600: '#b8874f',
      700: '#a67340',
      800: '#8a5f35',
      900: '#724f2d',
      950: '#3d2818',
    },
    colorScheme: {
      light: {
        primary: {
          color: 'oklch(0.705 0.213 47.604)', // --primary
          contrastColor: 'oklch(0.98 0.016 73.684)', // --primary-foreground
          hoverColor: 'oklch(0.675 0.213 47.604)',
          activeColor: 'oklch(0.645 0.213 47.604)',
        },
        surface: {
          0: 'oklch(1 0 0)', // --background
          50: 'oklch(0.985 0 0)', // --sidebar
          100: 'oklch(0.967 0.001 286.375)', // --secondary
          200: 'oklch(0.92 0.004 286.32)', // --border
          300: 'oklch(0.705 0.015 286.067)',
          400: 'oklch(0.552 0.016 285.938)', // --muted-foreground
          500: 'oklch(0.21 0.006 285.885)', // --secondary-foreground
          600: 'oklch(0.141 0.005 285.823)', // --foreground
          700: 'oklch(0.141 0.005 285.823)',
          800: 'oklch(0.141 0.005 285.823)',
          900: 'oklch(0.141 0.005 285.823)',
          950: 'oklch(0.141 0.005 285.823)',
        },
      },
      dark: {
        primary: {
          color: 'oklch(0.646 0.222 41.116)', // --primary (dark)
          contrastColor: 'oklch(0.98 0.016 73.684)', // --primary-foreground
          hoverColor: 'oklch(0.676 0.222 41.116)',
          activeColor: 'oklch(0.616 0.222 41.116)',
        },
        surface: {
          0: 'oklch(0.141 0.005 285.823)', // --background (dark)
          50: 'oklch(0.21 0.006 285.885)', // --sidebar (dark)
          100: 'oklch(0.274 0.006 286.033)', // --secondary (dark)
          200: 'oklch(1 0 0 / 10%)', // --border (dark)
          300: 'oklch(0.705 0.015 286.067)',
          400: 'oklch(0.705 0.015 286.067)', // --muted-foreground (dark)
          500: 'oklch(0.985 0 0)', // --foreground (dark)
          600: 'oklch(0.985 0 0)',
          700: 'oklch(0.985 0 0)',
          800: 'oklch(0.985 0 0)',
          900: 'oklch(0.985 0 0)',
          950: 'oklch(0.985 0 0)',
        },
      },
    },
  },
});


bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: myPreset
      }
    })
  ],
});

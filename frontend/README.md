# 🏥 Medical AI Dashboard - Frontend

Modern React-based medical AI interface with real-time data management and enterprise-grade security.

## ✨ Key Features

- **🔐 Clerk Authentication** - Enterprise-grade user management with rate limiting
- **📊 Real-Time History** - Auto-refreshing medical history every 30 seconds  
- **🖼️ Image Preview** - Direct API-based image serving with smart deduplication
- **🧹 Cleanup Tools** - One-click duplicate removal and file management
- **📱 Responsive Design** - Mobile-first UI with modern CSS animations
- **🚀 Performance** - Vite-powered development with optimized builds

## 🛠️ Tech Stack

- **React 18** + **TypeScript** + **Vite** for modern development
- **Clerk** for authentication and user management  
- **Custom CSS** with advanced animations and gradients
- **REST API Integration** with Flask backend (localhost:8503)

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

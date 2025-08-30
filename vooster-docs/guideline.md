```markdown
# Realtime Subway Notification App - Code Guidelines

## 1. Project Overview

This project is a real-time subway notification application for the Seoul metropolitan area, built using React Native, TypeScript, Firebase, and related technologies. The application provides users with real-time train arrival and delay information, along with alternative route suggestions. Key architectural decisions include using Firebase Firestore for real-time data synchronization, Firebase Cloud Functions for backend logic, and React Native for cross-platform development.  The application architecture is a domain-driven, layer-based architecture with feature-based modules.

## 2. Core Principles

*   **Maintainability:** Code should be easy to understand, modify, and extend.
*   **Readability:** Code should be clear, concise, and well-documented.
*   **Testability:** Code should be designed to be easily tested (unit, integration, and end-to-end).
*   **Performance:** Code should be optimized for speed and efficiency.
*   **Scalability:** The architecture should support future growth and increased user load.

## 3. Language-Specific Guidelines

### 3.1. TypeScript

*   **File Organization:**
    *   Use the folder structure defined in the TRD.
    *   Group related components, services, and models within their respective directories.
*   **Import/Dependency Management:**
    *   Use absolute imports for internal modules (e.g., `import Train from 'src/models/train';`).
    *   Use npm or yarn for dependency management.  Keep dependencies up-to-date.
*   **Error Handling:**
    *   Use `try...catch` blocks for handling potential errors.
    *   Create custom error classes for specific error scenarios.
    *   Log errors using a consistent logging mechanism (e.g., `console.error`).
*   **Typing:**
    *   **MUST** use explicit types for all variables, function parameters, and return values.  Use `any` only as a last resort and document why it is necessary.
    *   **MUST** define interfaces or types for data models.
    *   **MUST** leverage TypeScript's features like enums, generics, and union types where appropriate.

### 3.2. React Native

*   **File Organization:**
    *   Follow the component-based structure. Each component should reside in its own directory with related files (e.g., `ComponentName/ComponentName.tsx`, `ComponentName/ComponentName.styles.ts`).
*   **State Management:**
    *   Use React Context API or Redux for global state management.  Choose the appropriate solution based on the complexity of the state.
    *   Use `useState` for local component state.
*   **Styling:**
    *   Use TailwindCSS or Styled-components (consistent with the project's choice).
    *   Keep styles separate from components in `.styles.ts` files.
*   **Component Structure:**
    *   Create small, reusable components.
    *   Use functional components with hooks whenever possible.
    *   Separate presentation (UI) from logic (data fetching, state updates) within components.

### 3.3. Firebase

*   **Firestore:**
    *   Organize data in Firestore using a consistent schema.
    *   Use appropriate indexing for efficient queries.
    *   Implement security rules to protect data.
    *   Use transactions to ensure data consistency.
*   **Cloud Functions:**
    *   Keep functions small and focused.
    *   Use environment variables for configuration.
    *   Implement proper error handling and logging.
    *   Use TypeScript for all Cloud Functions.
*   **Authentication:**
    *   Use Firebase Auth for user authentication.
    *   Handle authentication state changes using React Context or Redux.
    *   Implement proper authorization based on user roles.

### 3.4. Expo

*   **Configuration:**
    *   Use `app.json` or `app.config.js` for configuring the Expo app.
    *   Manage environment variables using Expo's built-in support.
*   **Plugins:**
    *   Use Expo plugins for accessing native device features.
    *   Keep plugins up-to-date.

## 4. Code Style Rules

### 4.1. MUST Follow:

*   **Naming Conventions:**
    *   Variables: `camelCase` (e.g., `trainArrivalTime`)
    *   Functions: `camelCase` (e.g., `getTrainData`)
    *   Components: `PascalCase` (e.g., `TrainDetails`)
    *   Interfaces/Types: `PascalCase` (e.g., `Train`)
    *   Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_TRAIN_COUNT`)
    *   Files: `kebab-case` (e.g., `train-details.tsx`)
    *   Rationale: Consistent naming improves readability and maintainability.
*   **Indentation:**
    *   Use 2 spaces for indentation.
    *   Rationale: Consistent indentation improves readability.
*   **Line Length:**
    *   Limit lines to 120 characters.
    *   Rationale: Improves readability on various screen sizes.
*   **Comments:**
    *   Write clear and concise comments to explain complex logic or non-obvious code.
    *   Use JSDoc style comments for documenting functions and components.
    *   Rationale: Comments aid understanding and maintenance.
*   **Error Handling:**
    *   **MUST** implement comprehensive error handling using `try...catch` blocks.
    *   **MUST** log errors with sufficient context for debugging.
    *   **MUST** provide user-friendly error messages.
    *   Rationale: Prevents application crashes and provides valuable debugging information.
*   **Code Formatting:**
    *   Use Prettier to automatically format code.
    *   Rationale: Enforces a consistent code style across the project.
*   **Immutability:**
    *   Favor immutable data structures.  Use methods like `map`, `filter`, and `reduce` to avoid modifying existing arrays.
    *   Rationale: Improves predictability and avoids unexpected side effects.
*   **State Management:**
    *   **MUST** choose either React Context or Redux.
    *   **MUST** use reducers for complex state updates in Redux.
    *   **MUST** separate state logic from UI components.
    *   Rationale: Centralized state management simplifies debugging and allows for better component reusability.
*   **API Calls:**
    *   **MUST** encapsulate API calls in dedicated service files.
    *   **MUST** handle API errors gracefully.
    *   **MUST** use environment variables for API endpoints.
    *   Rationale: Promotes code reusability and makes it easier to manage API endpoints.
*   **Security:**
    *   **MUST** sanitize user inputs to prevent XSS attacks.
    *   **MUST** use HTTPS for all API requests.
    *   **MUST** protect sensitive data using encryption.
    *   Rationale: Protects the application and user data from security vulnerabilities.
*   **Performance:**
    *   **MUST** optimize images before uploading them to AWS S3.
    *   **MUST** use memoization techniques (e.g., `React.memo`) to prevent unnecessary re-renders.
    *   **MUST** avoid performing expensive operations in the main thread.
    *   Rationale: Improves application performance and responsiveness.

### 4.2. MUST NOT Do:

*   **Global Variables:**
    *   **MUST NOT** use global variables.
    *   Rationale: Global variables can lead to naming conflicts and make it difficult to track state.
*   **Magic Numbers/Strings:**
    *   **MUST NOT** use magic numbers or strings directly in the code. Define constants instead.
    *   Rationale: Improves readability and makes it easier to update values.
*   **Nested Callbacks:**
    *   **MUST NOT** use deeply nested callbacks (callback hell). Use Promises or async/await instead.
    *   Rationale: Improves readability and makes it easier to handle asynchronous operations.
*   **Console.log in Production:**
    *   **MUST NOT** leave `console.log` statements in production code.
    *   Rationale: `console.log` statements can impact performance and expose sensitive information.
*   **Ignoring Errors:**
    *   **MUST NOT** ignore errors. Handle them appropriately.
    *   Rationale: Ignoring errors can lead to unexpected behavior and make it difficult to debug issues.
*   **Direct DOM Manipulation:**
    *   **MUST NOT** directly manipulate the DOM in React Native components. Use React's state management and rendering mechanisms instead.
    *   Rationale: Direct DOM manipulation can lead to inconsistencies and performance issues.
*   **Over-commenting:**
    *   **MUST NOT** over-comment code. Comments should explain the *why*, not the *what*.
    *   Rationale: Too many comments can clutter the code and make it difficult to read.
*   **Committing Secrets to Git:**
    *   **MUST NOT** commit API keys, passwords, or other sensitive information to Git. Use environment variables instead.
    *   Rationale: Prevents security breaches.
*   **Large Components:**
    *   **MUST NOT** create huge, multi-responsibility components in a single file. Break down components into smaller, reusable pieces.
    *   Rationale: Large components are difficult to understand, maintain, and test.
*   **Complex State Management Pattern:**
    *   **MUST NOT** overcomplicate state management. Start with simple solutions like `useState` or React Context and only move to more complex solutions like Redux if necessary.
    *   Rationale: Overcomplicating state management can lead to unnecessary complexity and performance issues.

## 5. Architecture Patterns

### 5.1. Component/Module Structure Guidelines

*   **Domain-Driven Design:** Organize code around business domains (e.g., `trains`, `users`, `notifications`).
*   **Layered Architecture:** Separate UI components, business logic, and data access layers.
*   **Feature-Based Modules:** Group components, services, and models related to a specific feature (e.g., `real-time-alerts`, `alternative-routes`).
*   **Shared Components:** Create a `common` directory for reusable UI components and utility functions.

### 5.2. Data Flow Patterns

*   **Unidirectional Data Flow:** Data flows from parent components to child components via props. Child components update the state of parent components via callbacks.
*   **Client-Server Communication:** React Native app communicates with Firebase Cloud Functions via HTTP requests.
*   **Real-time Updates:** Firebase Firestore's real-time listeners are used to push data updates to the React Native app.

### 5.3. State Management Conventions

*   **React Context API (for simple state):**
    *   Create a context provider to manage state.
    *   Use `useContext` hook to access state from components.
*   **Redux (for complex state):**
    *   Define actions, reducers, and a store.
    *   Use `connect` or `useSelector` and `useDispatch` to connect components to the store.

### 5.4. API Design Standards

*   **RESTful API:** Cloud Functions should expose RESTful APIs with standard HTTP methods (GET, POST, PUT, DELETE).
*   **JSON Format:** Use JSON for request and response bodies.
*   **Error Handling:** Return appropriate HTTP status codes for errors (e.g., 400 for bad request, 500 for server error).
*   **Versioning:** Use API versioning to maintain backwards compatibility.

## Example Code Snippets

```typescript
// MUST: Using explicit types
interface User {
  id: string;
  name: string;
  email: string;
}

const getUser = (id: string): User => {
  // ... fetch user from database
  return { id: id, name: "John Doe", email: "john.doe@example.com" };
};
// Explanation: Explicit types improve code clarity and prevent type-related errors.

// MUST NOT: Using implicit any
const getUserBad = (id) => {
  // ... fetch user from database
  return { id: id, name: "John Doe", email: "john.doe@example.com" };
};
// Explanation: Implicit `any` types disable type checking and can lead to runtime errors.  Always use explicit types.
```

```typescript
// MUST: Example of a React component using functional component and hooks
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  trainId: string;
}

const TrainDetails: React.FC<Props> = ({ trainId }) => {
  const [trainData, setTrainData] = useState(null);

  useEffect(() => {
    // Fetch train data using an API call or Firebase
    const fetchTrainData = async () => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      setTrainData({ id: trainId, delay: 5 });
    };

    fetchTrainData();
  }, [trainId]);

  if (!trainData) {
    return <Text>Loading...</Text>;
  }

  return (
    <View style={styles.container}>
      <Text>Train ID: {trainData.id}</Text>
      <Text>Delay: {trainData.delay} minutes</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
});

export default TrainDetails;

// Explanation: This example demonstrates a well-structured React component using functional components, hooks for state management and side effects, and a separate styles object.

// MUST NOT: Example of a large, complex component with mixed concerns
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';

const TrainDetailsBad = () => {
  const [trainId, setTrainId] = useState('');
  const [trainData, setTrainData] = useState(null);
  const [error, setError] = useState(null);

  const fetchTrainData = async () => {
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (trainId === 'error') {
        throw new Error('Failed to fetch train data');
      }
      setTrainData({ id: trainId, delay: 5 });
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text>Enter Train ID:</Text>
      <TextInput
        style={styles.input}
        value={trainId}
        onChangeText={setTrainId}
      />
      <Button title="Get Details" onPress={fetchTrainData} />
      {trainData && (
        <View>
          <Text>Train ID: {trainData.id}</Text>
          <Text>Delay: {trainData.delay} minutes</Text>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const stylesBad = StyleSheet.create({
  container: {
    padding: 10,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
  },
  error: {
    color: 'red',
  },
});

// Explanation: This component mixes UI, state management, data fetching, and error handling in a single file, making it difficult to understand, maintain, and test.  It should be broken down into smaller, more focused components.
```

```typescript
// MUST: Using try...catch for error handling in Cloud Functions
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const getTrainStatus = functions.https.onRequest(async (req, res) => {
  try {
    const trainId = req.query.trainId;

    if (!trainId) {
      throw new Error('Train ID is required');
    }

    const snapshot = await admin.firestore().collection('trains').doc(trainId as string).get();

    if (!snapshot.exists) {
      throw new Error('Train not found');
    }

    const trainData = snapshot.data();

    res.status(200).send(trainData);
  } catch (error: any) {
    console.error('Error getting train status:', error);
    res.status(500).send(`Error getting train status: ${error.message}`);
  }
});

// Explanation: This example demonstrates proper error handling in a Cloud Function using try...catch blocks and logging errors to the console.  It also returns appropriate HTTP status codes for different error scenarios.

// MUST NOT: Ignoring errors in Cloud Functions
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const getTrainStatusBad = functions.https.onRequest(async (req, res) => {
  const trainId = req.query.trainId;

  const snapshot = await admin.firestore().collection('trains').doc(trainId as string).get();
  const trainData = snapshot.data();

  res.status(200).send(trainData);
});

// Explanation: This function does not handle any potential errors, such as a missing train ID, a non-existent train, or a database error.  This can lead to unexpected behavior and make it difficult to debug issues.
```

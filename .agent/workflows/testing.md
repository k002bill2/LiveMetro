---
description: Testing Workflow and Templates
---

# Testing Workflow

## 1. Unit Testing (Jest)

### Template
```javascript
describe('ServiceName', () => {
  let service;
  let mockDependency;

  beforeEach(() => {
    mockDependency = {
      method: jest.fn()
    };
    service = new Service(mockDependency);
  });

  describe('methodName', () => {
    it('should return expected result when input is valid', async () => {
      // Arrange
      const input = '...';
      const expected = '...';
      mockDependency.method.mockResolvedValue('...');

      // Act
      const result = await service.methodName(input);

      // Assert
      expect(result).toEqual(expected);
      expect(mockDependency.method).toHaveBeenCalledWith(input);
    });

    it('should throw error when input is invalid', async () => {
      // Arrange
      mockDependency.method.mockRejectedValue(new Error('...'));

      // Act & Assert
      await expect(service.methodName('...')).rejects.toThrow();
    });
  });
});
```

## 2. Integration Testing

Test API endpoints or component interactions.

### API Test Template (Supertest/Axios)
```javascript
describe('GET /api/resource', () => {
  it('should return 200 and data', async () => {
    const response = await request(app).get('/api/resource');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
  });
});
```

## 3. Coverage Analysis

Run coverage reports to ensure quality.

```bash
npm test -- --coverage
```

**Targets**:
-   Statements: > 80%
-   Branches: > 80%
-   Functions: > 80%
-   Lines: > 80%

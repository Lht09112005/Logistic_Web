import { sendSuccess, sendError } from '../utils/response';
import { Response } from 'express';

describe('Response Helpers Unit Tests', () => {
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockImplementation(() => ({
      json: jsonMock,
    }));
    mockResponse = {
      status: statusMock,
    };
  });

  test('should send a successful JSON response with correct status', () => {
    const data = { foo: 'bar' };
    sendSuccess(mockResponse as Response, data, 'Success Msg', 200);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      success: true,
      message: 'Success Msg',
      data,
    });
  });

  test('should send an error JSON response with custom error data and status', () => {
    const errors = { field: 'email is required' };
    sendError(mockResponse as Response, 'Validation Fail', 400, errors);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      message: 'Validation Fail',
      errors,
    });
  });
});

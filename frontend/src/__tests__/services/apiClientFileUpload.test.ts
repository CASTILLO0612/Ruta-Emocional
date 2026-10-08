jest.mock('expo-file-system/legacy', () => ({
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  uploadAsync: jest.fn(),
}));

jest.mock('../../config/runtimeConfig', () => ({
  getLegacyApiBaseUrl: () => 'https://api.example.test/api',
  getVersionOneApiBaseUrl: () => 'https://api.example.test/api/v1',
}));

import { uploadAsync } from 'expo-file-system/legacy';
import { apiV1FileRequest, setAuthToken } from '../../services/apiClient';

const uploadMock = uploadAsync as jest.MockedFunction<typeof uploadAsync>;

describe('apiV1FileRequest', () => {
  beforeEach(() => {
    uploadMock.mockReset();
    setAuthToken('access-token');
  });

  afterAll(() => setAuthToken(null));

  it('transfiere el URI local como contenido binario sin construir File', async () => {
    uploadMock.mockResolvedValue({
      status: 200,
      body: JSON.stringify({ data: { id: 'user-1' } }),
      headers: {},
      mimeType: 'application/json',
    });

    await expect(apiV1FileRequest(
      '/auth/me/photo',
      'file:///cache/profile-photo.jpg',
      { contentType: 'image/jpeg', fileName: 'profile-photo.jpg' }
    )).resolves.toEqual({ data: { id: 'user-1' } });

    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/auth\/me\/photo$/),
      'file:///cache/profile-photo.jpg',
      expect.objectContaining({
        httpMethod: 'PUT',
        uploadType: 0,
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
          'Content-Type': 'image/jpeg',
        }),
      })
    );
  });

  it('encapsula cualquier excepción nativa en un error estable', async () => {
    uploadMock.mockRejectedValue(new TypeError('this.validatePath is not a function'));

    await expect(apiV1FileRequest(
      '/auth/me/photo',
      'file:///cache/profile-photo.jpg',
      { contentType: 'image/jpeg', fileName: 'profile-photo.jpg' }
    )).rejects.toEqual(expect.objectContaining({
      code: 'FILE_UPLOAD_ERROR',
      status: 0,
    }));
  });
});

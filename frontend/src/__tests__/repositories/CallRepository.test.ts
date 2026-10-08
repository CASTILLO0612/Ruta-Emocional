import {
  finishCall,
  getCall,
  joinCall,
  startCall,
} from '../../repositories/CallRepository';
import { apiV1Request } from '../../services/apiClient';

jest.mock('../../services/apiClient', () => ({ apiV1Request: jest.fn() }));

const request = apiV1Request as jest.MockedFunction<typeof apiV1Request>;

describe('CallRepository', () => {
  beforeEach(() => request.mockReset());

  it('starts an outgoing call with modality and receives ephemeral credentials', async () => {
    const response = {
      data: {
        call: { id: 'call-id', status: 'RINGING' },
        credentials: { serverUrl: 'wss://rtc.example.test', accessToken: 'token' },
      },
    };
    request.mockResolvedValue(response as never);

    await expect(startCall('conversation-id', 'VIDEO')).resolves.toEqual(response.data);
    expect(request).toHaveBeenCalledWith(
      '/conversations/conversation-id/calls',
      'POST',
      { mediaType: 'VIDEO' }
    );
  });

  it('loads, joins and ends calls only through the authenticated API', async () => {
    request.mockResolvedValue({ data: { id: 'call-id' } } as never);
    await getCall('call-id');
    await joinCall('call-id');
    await finishCall('call-id');
    expect(request.mock.calls.map(([endpoint, method]) => [endpoint, method])).toEqual([
      ['/calls/call-id', undefined],
      ['/calls/call-id/join', 'POST'],
      ['/calls/call-id/end', 'POST'],
    ]);
  });
});

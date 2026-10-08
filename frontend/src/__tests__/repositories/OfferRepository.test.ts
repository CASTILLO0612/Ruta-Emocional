import * as apiClient from '../../services/apiClient';
import { getOwnOffers, withdrawOffer } from '../../repositories/OfferRepository';

const apiOffer = {
  id: 'offer-1',
  requestId: 'request-1',
  professional: {
    profileId: 'profile-1',
    displayName: 'Diana Castillo',
    photoUrl: null,
    primarySpecialty: 'Psicología clínica',
    rating: 4.8,
    totalReviews: 12,
  },
  price: { amount: '500.00', currency: 'NIO' },
  message: null,
  status: 'PENDING' as const,
  createdAt: '2026-10-06T12:00:00.000Z',
  updatedAt: '2026-10-06T12:00:00.000Z',
};

describe('OfferRepository', () => {
  afterEach(() => jest.restoreAllMocks());

  it('pagina las ofertas propias y transforma únicamente el contexto permitido', async () => {
    const request = jest.spyOn(apiClient, 'apiV1Request').mockResolvedValue({
      data: [{
        offer: apiOffer,
        request: {
          modality: 'CALL',
          primaryNeed: 'Manejo de ansiedad',
          proposedBudget: { amount: '450.00', currency: 'NIO' },
          status: 'BIDDING',
          scheduledFor: null,
          expiresAt: '2026-10-07T12:00:00.000Z',
        },
      }],
      meta: { nextCursor: 'next-page' },
    });

    const page = await getOwnOffers('current page');

    expect(request).toHaveBeenCalledWith(
      '/offers/me?limit=20&cursor=current+page',
      'GET',
      undefined,
      { signal: undefined }
    );
    expect(page.nextCursor).toBe('next-page');
    expect(page.items[0]).toEqual(expect.objectContaining({
      offer: expect.objectContaining({ status: 'pending', amount: 500 }),
      request: expect.objectContaining({ modality: 'call', proposedBudget: 450 }),
    }));
  });

  it('codifica los identificadores al retirar una oferta', async () => {
    const request = jest.spyOn(apiClient, 'apiV1Request').mockResolvedValue({
      data: { ...apiOffer, status: 'WITHDRAWN' },
    });

    await expect(withdrawOffer('request/1', 'offer/1')).resolves.toEqual(
      expect.objectContaining({ status: 'withdrawn' })
    );
    expect(request).toHaveBeenCalledWith(
      '/service-requests/request%2F1/offers/offer%2F1/withdraw',
      'POST'
    );
  });
});

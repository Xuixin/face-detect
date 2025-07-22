import { TestBed } from '@angular/core/testing';

import { PicoService } from './pico.service';

describe('PicoService', () => {
  let service: PicoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PicoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

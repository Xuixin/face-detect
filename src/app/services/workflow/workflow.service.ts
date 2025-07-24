import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

type FlowObject = {
  [key: string]: { [key: string]: any };
};

@Injectable({
  providedIn: 'root',
})
export class WorkflowService {
  private flowObjectSubject = new BehaviorSubject<FlowObject | null>(null);
  public flowObject$: Observable<FlowObject | null> =
    this.flowObjectSubject.asObservable();

  constructor() {}

  private modalIdToComponentMap: { [key: number]: () => Promise<any> } = {
    1: () => import('./../../pages/home/home.page').then((m) => m.HomePage),
  };

  async loadComponentByPageId(modalId: number): Promise<any> {
    const loader = this.modalIdToComponentMap[modalId];
    if (!loader) throw new Error(`No component mapped for pageId ${modalId}`);
    return await loader();
  }

  async getModalComponentById(id: number) {
    const component = await this.loadComponentByPageId(id)
    return component
  }
}

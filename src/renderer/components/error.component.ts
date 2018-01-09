import { Component } from '@angular/core';
import { ErrorService } from '../services';
import { Observable } from 'rxjs';
import { NonfatalError } from '../../lib/error.model';

@Component({
    selector: 'error',
    template: `
        <div class="container">
            <ng-container *ngIf="(errorObservable | async) as error">
                <div class="error">
                    <mat-toolbar>
                        {{error.title}}
                    </mat-toolbar>
                    <div>{{error.description}}</div>
                </div>
                <div class="error">
                    <mat-toolbar>
                    Stack trace (provide this if you're posting an issue on github):
                    </mat-toolbar>
                    <div>{{error.error.stack}}</div>
                </div>
            </ng-container>
        </div>
    `,
    styleUrls: ['../styles/error.component.scss']
})
export class ErrorComponent {
    private errorObservable: Observable<NonfatalError> = undefined;

    constructor(private errorService: ErrorService) { }

    ngOnInit() {
        this.errorObservable = this.errorService.error;
    }
}
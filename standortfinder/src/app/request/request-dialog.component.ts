import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  email,
  form,
  FormField,
  required,
  submit,
} from '@angular/forms/signals';
import { FinderStore } from '../finder/finder.store';

interface RequestFormModel {
  salutation: string;
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  companyLocation: string;
  period: string;
  message: string;
  privacyAccepted: boolean;
}

@Component({
  selector: 'app-request-dialog',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-dialog.component.html',
  styleUrl: './request-dialog.component.css',
})
export class RequestDialogComponent {
  protected readonly store = inject(FinderStore);
  protected readonly submissionNotice = signal('');
  protected readonly submissionError = signal(false);
  protected readonly model = signal<RequestFormModel>({
    salutation: '', firstName: '', lastName: '', company: '', email: '', phone: '',
    companyLocation: '', period: '', message: '', privacyAccepted: false,
  });
  protected readonly requestForm = form(this.model, (path) => {
    required(path.salutation, { message: 'Bitte wählen Sie eine Anrede.' });
    required(path.firstName, { message: 'Bitte geben Sie Ihren Vornamen ein.' });
    required(path.lastName, { message: 'Bitte geben Sie Ihren Nachnamen ein.' });
    required(path.company, { message: 'Bitte geben Sie Ihr Unternehmen ein.' });
    required(path.email, { message: 'Bitte geben Sie Ihre E-Mail-Adresse ein.' });
    email(path.email, { message: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' });
    required(path.companyLocation, { message: 'Bitte wählen Sie den Firmensitz.' });
    required(path.message, { message: 'Bitte beschreiben Sie Ihr Anliegen.' });
    required(path.privacyAccepted, { message: 'Bitte bestätigen Sie den Datenschutz.' });
  });

  protected close(): void {
    this.submissionError.set(false);
    this.submissionNotice.set('');
    this.store.closeRequestDialog();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.submissionError.set(false);
    if (this.requestForm().invalid()) {
      this.submissionError.set(true);
      this.submissionNotice.set('Bitte prüfen Sie die mit * gekennzeichneten Felder.');
      return;
    }

    submit(this.requestForm, async () => {
      this.submissionNotice.set(
        'Die Online-Übermittlung ist noch nicht an einen Anfrage-Endpunkt angebunden. ' +
          'Ihre Eingaben wurden nicht versendet. Bitte nutzen Sie den Kontakt-Link oder exportieren Sie Ihre Auswahl.',
      );
    });
  }
}

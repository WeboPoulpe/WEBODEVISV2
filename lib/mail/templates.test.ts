import { describe, expect, it } from 'vitest';
import { passwordChangedEmail, passwordResetEmail,prospectAckEmail, prospectNotificationEmail, quoteProposalEmail, welcomeEmail } from './templates';

const prospect = {
  firstName: 'Claire',
  lastName: 'Martin',
  email: 'claire@exemple.fr',
  phone: '06 00 00 00 00',
  eventType: 'Mariage',
  eventDate: '2027-06-12',
  guestCount: 80,
  guestCountChildren: 6,
  location: 'Troyes',
  message: 'Bonjour,\nnous cherchons un traiteur.',
};

describe('emails', () => {
  it('bienvenue : prénom dans le titre et bouton vers l’app', () => {
    const mail = welcomeEmail({ firstName: 'Francis', appUrl: 'https://webodevis.fr' });
    expect(mail.subject).toBe('Bienvenue sur WeboDevis');
    expect(mail.html).toContain('Bienvenue Francis');
    expect(mail.html).toContain('href="https://webodevis.fr"');
  });

  it('mot de passe oublié : le lien est celui du bouton', () => {
    const mail = passwordResetEmail({ link: 'https://webodevis.fr/reset-password?token=abc' });
    expect(mail.html).toContain('href="https://webodevis.fr/reset-password?token=abc"');
    expect(mail.html).toContain('valable une heure');
  });

  it('mot de passe changé : prévient et renvoie vers la connexion', () => {
    const mail = passwordChangedEmail({ loginUrl: 'https://webodevis.fr/login' });
    expect(mail.subject).toBe('Votre mot de passe WeboDevis a été changé');
    expect(mail.html).toContain('href="https://webodevis.fr/login"');
    expect(mail.html).toContain('Mot de passe oublié');
  });

  it('nouvelle demande : détail de la demande et lien vers les prospects', () => {
    const mail = prospectNotificationEmail({ prospect, appUrl: 'https://webodevis.fr' });
    expect(mail.subject).toBe('Nouvelle demande de devis : Claire Martin');
    expect(mail.html).toContain('samedi 12 juin 2027');
    expect(mail.html).toContain('80, dont 6 enfants');
    expect(mail.html).toContain('nous cherchons un traiteur.');
    expect(mail.html).toContain('<br>');
    expect(mail.html).toContain('href="https://webodevis.fr/prospects"');
  });

  it('accusé de réception : au nom du traiteur, sans ligne vide', () => {
    const mail = prospectAckEmail({ companyName: 'Dupuis Traiteur', prospect: { ...prospect, location: null } });
    expect(mail.subject).toBe('Dupuis Traiteur a bien reçu votre demande');
    expect(mail.html).toContain('Merci Claire');
    expect(mail.html).not.toContain('>Lieu<');
    expect(mail.html).toContain('Envoyé par Dupuis Traiteur avec WeboDevis.');
  });

  it('devis : message du traiteur, lien du devis', () => {
    const mail = quoteProposalEmail({
      companyName: 'Dupuis Traiteur', clientName: 'Claire', eventType: 'Mariage', eventDate: '2027-06-12',
      guestCount: 80, message: 'Voici notre proposition.\nÀ bientôt', link: 'https://webodevis.fr/d/abcDEF123',
    });
    expect(mail.subject).toBe('Votre devis Dupuis Traiteur, mariage');
    expect(mail.html).toContain('Bonjour Claire');
    expect(mail.html).toContain('Voici notre proposition.<br>À bientôt');
    expect(mail.html).toContain('href="https://webodevis.fr/d/abcDEF123"');
  });

  it('les textes saisis ne peuvent pas injecter de HTML', () => {
    const mail = prospectNotificationEmail({
      prospect: { ...prospect, firstName: '<script>alert(1)</script>', message: '<img src=x onerror=alert(1)>' },
      appUrl: 'https://webodevis.fr',
    });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).not.toContain('<img');
    expect(mail.html).toContain('&lt;script&gt;');

    const quote = quoteProposalEmail({
      companyName: 'A & B <b>', clientName: '', eventType: null, eventDate: null, guestCount: null,
      message: '<a href="https://piege.example">clic</a>', link: 'https://webodevis.fr/d/x',
    });
    expect(quote.html).not.toContain('<a href="https://piege.example">');
    expect(quote.html).toContain('A &amp; B &lt;b&gt;');
  });
});

import { NodeAngularSeedPage } from './app.po';

describe('node-angular-seed App', () => {
  let page: NodeAngularSeedPage;

  beforeEach(() => {
    page = new NodeAngularSeedPage();
  });

  it('should display welcome message', done => {
    page.navigateTo();
    page.getParagraphText()
      .then(msg => expect(msg).toEqual('Welcome to app!!'))
      .then(done, done.fail);
  });
});

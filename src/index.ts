import { setChangelogs } from './actions';
import ChangelogDashlet from './ChangelogDashlet';
import sessionReducer from './reducers';

import Promise from 'bluebird';
import * as _ from 'lodash';
import * as path from 'path';
import * as Redux from 'redux';
import { log, types, util } from 'vortex-api';

function updateReleases(store: Redux.Store<types.IState>): Promise<void> {
  if (!(store.getState().session.base as any).networkConnected) {
    return Promise.resolve();
  }
  return util.github.releases()
    .then(releases => {
      const state: types.IState = store.getState();
      const persistentLogs =
        util.getSafe(state, ['persistent', 'changelogs', 'changelogs'], []);

      const len = releases.length;

      if ((persistentLogs.length !== len)
        || (persistentLogs[len - 1].version !== releases[len - 1].name)) {
        const changeLogs = releases.map(rel => ({
          version: rel.name,
          text: rel.body,
          prerelease: rel.prerelease,
        }));

        store.dispatch(setChangelogs(changeLogs));
      }
    });
}

function main(context: types.IExtensionContext) {
  context.registerDashlet('Changelog', 1, 3, 200, ChangelogDashlet,
    (state: types.IState) => true,
  () => ({}), { closable: true });

  // We store changelogs persistently, so even on a rare edge case
  //  where the user has exceeded his GitHub rate limit (shouldn't be possible)
  //  we still have data to display.
  context.registerReducer(['persistent', 'changelogs'], sessionReducer);

  context.once(() => {
    context.api.setStylesheet('changelog',
      path.join(__dirname, 'changelog.scss'));
    updateReleases(context.api.store)
      .catch(err => {
        log('warn', 'failed to retrieve list of releases', err.message);
      });
  });

  return true;
}

export default main;

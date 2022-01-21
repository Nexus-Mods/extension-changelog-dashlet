import { setChangelogs } from './actions';
import ChangelogDashlet from './ChangelogDashlet';
import sessionReducer from './reducers';

import Promise from 'bluebird';
import * as _ from 'lodash';
import * as path from 'path';
import * as Redux from 'redux';
import * as semver from 'semver';
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

function updateModal(api: types.IExtensionApi, oldVersion: string): Promise<void> {
  if (semver.lt(oldVersion, '0.0.2')) {
    return api.showDialog('info', 'Vortex 1.5 update', {
      md: 'In Vortex 1.5 we are introducing the new Collections feature.\n\n'
        + 'For those unfamiliar with the Collections feature, '
        + 'it\'s a project we\'ve been working on for several years which will '
        + 'allow users to curate and share lists of their favourite mods - '
        + 'along with important metadata - with others. '
        + 'These tailored experiences will serve as a great introduction to '
        + 'modding a new game and allow a convenient way of helping users '
        + 'replicate a working setup.\n\n'
        + 'You can learn more about Collections in our '
        + '[original announcement](https://www.nexusmods.com/news/14568) '
        + 'or the [documentation](https://modding.wiki/en/nexusmods/collections/testing/roadmap#open-alpha).\n\n'
        + 'Please make use of the "feedback prompts" in Vortex and on '
        + 'Nexus Mods Next to submit bug reports and feature suggestions, '
        + 'or discuss Collections in the appropriate channels on our '
        + '[official Discord server](https://discord.gg/nexusmods).',
    }, [
      { label: 'Close' },
    ])
      .then(() => null);
  }

  return Promise.resolve();
}

function main(context: types.IExtensionContext) {
  // We store changelogs persistently, so even on a rare edge case
  //  where the user has exceeded his GitHub rate limit (shouldn't be possible)
  //  we still have data to display.
  context.registerReducer(['persistent', 'changelogs'], sessionReducer);

  context.registerMigration(oldVersion => updateModal(context.api, oldVersion));

  context.registerDashlet('Changelog', 1, 3, 200, ChangelogDashlet,
    (state: types.IState) => true,
  () => ({}), { closable: true });

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

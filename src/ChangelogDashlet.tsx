import { remote } from 'electron';
import * as React from 'react';
import { Pager } from 'react-bootstrap';
import { translate } from 'react-i18next';
import { connect } from 'react-redux';
import * as semver from 'semver';
import { ComponentEx, Dashlet } from 'vortex-api';

interface IConnectedProps {
  changelogs: Array<{ version: string, text: string, prerelease: boolean }>;
}

interface IActionProps {
}

type IProps = IConnectedProps & IActionProps;

interface IIssueListState {
  current: number;
}

class ChangelogDashlet extends ComponentEx<IProps, IIssueListState> {
  private mAppVersion: string;
  constructor(props: IProps) {
    super(props);

    this.mAppVersion = remote.app.getVersion();
    this.initState({
      current: 0,
    });
  }

  public componentWillMount() {
    this.nextState.current =
      this.props.changelogs.findIndex(changelog => semver.gte(changelog.version, this.mAppVersion));
  }

  public componentWillReceiveProps(nextProps: IProps) {
    if (this.props.changelogs !== nextProps.changelogs) {
      const appVersion = remote.app.getVersion();
      this.nextState.current = nextProps.changelogs.findIndex(changelog => semver.gte(changelog.version, appVersion));
    }
  }

  public render(): JSX.Element {
    const { t, changelogs } = this.props;
    const { current } = this.state;
    return (
      <Dashlet className='dashlet-changelog' title={t('Changelog')}>
        {(current < changelogs.length) ? this.renderContent() : null}
      </Dashlet>
    );
  }

  private renderContent() {
    const { t, changelogs } = this.props;
    const { current } = this.state;

    const changelog = changelogs[current];
    if (changelog === undefined) {
      return null;
    }

    return [
       (
        <Pager key={0}>
          <Pager.Item previous disabled={current === 0} onClick={this.prev}>
            {t('Previous')}
          </Pager.Item>
          {changelog.version}{changelog.prerelease ? ` (${t('Pre-release')})` : ''}
          <Pager.Item next disabled={current === changelogs.length - 1} onClick={this.next}>
            {t('Next')}
          </Pager.Item>
       </Pager>
       ),
      (
        <div className='changelog-text' key={1}>
          {changelog.text}
        </div>
       ),
    ];
  }

  private prev = () => {
    this.nextState.current = Math.max(0, this.state.current - 1);
  }

  private next = () => {
    const { changelogs } = this.props;
    this.nextState.current = Math.min(changelogs.length - 1, this.state.current + 1);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    changelogs: state.persistent.changelogs.changelogs,
  };
}

function mapDispatchToProps(dispatch: any): IActionProps {
  return {
  };
}

export default
  connect(mapStateToProps, mapDispatchToProps)(
    translate(['changelog-dashlet', 'common'], { wait: true })(
      ChangelogDashlet));

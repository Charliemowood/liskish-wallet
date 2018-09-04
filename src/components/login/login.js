import React from 'react';
import grid from 'flexboxgrid/dist/flexboxgrid.css';
import Input from 'react-toolbox/lib/input';
import Dropdown from 'react-toolbox/lib/dropdown';
import Button from 'react-toolbox/lib/button';
import i18next from 'i18next';
import { getPublicKeyFromLedgerIndex } from '../../utils/ledger';
import PassphraseInput from '../passphraseInput';
import styles from './login.css';
import env from '../../constants/env';
import networks from '../../constants/networks';
import loginTypes from '../../constants/loginTypes';
import getNetwork from '../../utils/getNetwork';
import LanguageDropdown from '../languageDropdown';
import RelativeLink from '../relativeLink';
import { validateUrl, getLoginData } from '../../utils/login';
import { loadingStarted, loadingFinished } from '../../utils/loading';
import to from '../../utils/to';

/**
 * The container component containing login
 * and create account functionality
 */
class Login extends React.Component {
  constructor() {
    super();

    this.state = {
      passphrase: '',
      address: '',
      network: networks.mainnet.code,
    };

    this.validators = {
      address: validateUrl,
      passphrase: this.validatePassphrase.bind(this),
    };
  }

  componentWillMount() {
    this.getNetworksList();
    i18next.on('languageChanged', () => {
      this.getNetworksList();
    });

    this.props.accountsRetrieved();
  }

  getNetworksList() {
    this.networks = Object.keys(networks).map((network, index) => ({
      label: i18next.t(networks[network].name),
      value: index,
    }));
  }

  componentDidUpdate() {
    if (this.props.account && this.props.account.address) {
      const tem = this.getReferrerRoute();
      this.props.history.replace(tem);
      if (this.state.address) {
        localStorage.setItem('address', this.state.address);
      }
      localStorage.setItem('network', this.state.network);
    }
    if (!this.account) {
      this.autoLogin();
    }
  }

  onLoginSubmission(passphrase) {
    const network = Object.assign({}, getNetwork(this.state.network));
    if (this.state.network === networks.customNode.code) {
      network.address = this.state.address;
    }

    // set active peer
    this.props.activePeerSet({
      passphrase,
      loginType: loginTypes.passphrase,
      network,
      hwInfo: {},
    });
  }

  getReferrerRoute() {
    const { isDelegate } = this.props.account;
    const { search } = this.props.history.location;
    const transactionRoute = '/main/transactions';
    const referrerRoute = search.indexOf('?referrer') === 0 ? search.replace('?referrer=', '') : transactionRoute;
    if (!isDelegate && referrerRoute === '/main/forging') {
      return transactionRoute;
    }
    return referrerRoute;
  }

  // eslint-disable-next-line class-methods-use-this
  validatePassphrase(value, error) {
    const data = { passphrase: value };
    data.passphraseValidity = error || '';
    return data;
  }

  changeHandler(name, value, error) {
    const validator = this.validators[name] || (() => ({}));
    this.setState({
      [name]: value,
      ...validator(value, error),
    });

    if (name === 'network' || name === 'address') {
      localStorage.setItem(name, value);
    }
  }

  devPreFill() {
    const { networkIndex, address, passphrase } = getLoginData();

    this.setState({
      network: networkIndex,
      ...this.validators.address(address),
      ...this.validators.passphrase(passphrase),
    });

    // ignore this in coverage as it is hard to test and does not run in production
    /* istanbul ignore if */
    if (!env.production && localStorage.getItem('autologin') && !this.props.account.afterLogout && passphrase) {
      setTimeout(() => {
        this.onLoginSubmission(passphrase);
      });
    }
  }

  onFormSubmit(event) {
    event.preventDefault();
    this.onLoginSubmission(this.state.passphrase);
  }

  autoLogin() {
    const { savedAccounts } = this.props;
    if (savedAccounts && savedAccounts.lastActive && !this.props.account.afterLogout) {
      this.account = savedAccounts.lastActive;
      const network = Object.assign({}, getNetwork(this.account.network));
      if (this.account.network === networks.customNode.code) {
        network.address = this.account.address;
      }

      // set active peer
      this.props.activePeerSet({
        publicKey: this.account.publicKey,
        loginType: this.account.loginType,
        network,
        hwInfo: this.account.hwInfo,
      });
    } else {
      this.account = 'not-saved';
      this.devPreFill();
    }
  }

  async ledgerLogin() {
    loadingStarted('ledgerLogin');

    let error;
    let ledgerPublicKey;
    // eslint-disable-next-line prefer-const
    [error, ledgerPublicKey] = await to(getPublicKeyFromLedgerIndex()); // by default index 0
    if (error) {
      const text = error && error.message ? `${error.message}.` : i18next.t('Error during login with Ledger.');
      this.props.errorToastDisplayed({ label: text });
    } else {
      const network = Object.assign({}, getNetwork(this.state.network));
      if (this.state.network === networks.customNode.code) {
        network.address = this.state.address;
      }
      // set active peer
      this.props.activePeerSet({
        publicKey: ledgerPublicKey,
        loginType: loginTypes.ledgerNano,
        network,
        hwInfo: {
          deviceId: ledgerPublicKey.substring(0, 10), // Use pubKey[0] first 10 char as device id
          derivationIndex: 0,
        },
      });
    }

    loadingFinished('ledgerLogin');
  }

  render() {
    return (
      <div className={`box ${styles.wrapper}`}>
        <div className={grid.row}>
          <div className={`${grid['col-xs-12']} ${grid['col-sm-8']} ${grid['col-sm-offset-2']}`}>
            <form onSubmit={this.onFormSubmit.bind(this)}>
              <LanguageDropdown />
              <Dropdown
                auto={false}
                source={this.networks}
                onChange={this.changeHandler.bind(this, 'network')}
                label={this.props.t('Select a network')}
                value={this.state.network}
                className={`${styles.network} network`}
              />
              {
                this.state.network === networks.customNode.code &&
                  <Input type='text'
                    label={this.props.t('Node address')}
                    name='address'
                    className='address'
                    theme={styles}
                    value={this.state.address}
                    error={this.state.addressValidity}
                    onChange={this.changeHandler.bind(this, 'address')} />
              }
              <PassphraseInput label={this.props.t('Enter your passphrase')}
                className='passphrase'
                theme={styles}
                error={this.state.passphraseValidity}
                value={this.state.passphrase}
                onChange={this.changeHandler.bind(this, 'passphrase')} />
              <footer className={ `${grid.row} ${grid['center-xs']}` }>
                <div className={grid['col-xs-12']}>
                  <RelativeLink to='register' flat primary
                    className={`${styles.newAccount} new-account-button`}>
                    {this.props.t('New Account')}
                  </RelativeLink>
                  <Button label={this.props.t('Login')} primary raised
                    className='login-button'
                    type='submit'
                    disabled={(this.state.network === networks.customNode.code && this.state.addressValidity !== '') ||
                    this.state.passphraseValidity !== ''} />
                </div>
              </footer>

              <div className={ `${grid.row} ${grid['col-xs-12']} ${grid['center-xs']}` }>

                <div className={ `${grid['col-xs-8']} ${grid['center-xs']}` }>
                  <br />
                  <hr className={`${styles.styleOr}`} />
                  <br />
                </div>

                <div className={grid['col-xs-12']}>
                  <Button label={this.props.t('Login with Ledger Nano S')} primary raised
                    className='login-button'
                    onClick={this.ledgerLogin.bind(this)}
                    type='button'
                    disabled={(this.state.network === networks.customNode.code && this.state.addressValidity !== '')} />
                </div>
              </div>

            </form>
          </div>
        </div>
      </div>
    );
  }
}

export default Login;

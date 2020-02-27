import React, { PureComponent, Fragment } from 'react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { connect } from 'dva';
import {
  Card,
  Button,
  myheaders,
  Col,
  Row,
  Menu,
  Dropdown,
  Icon,
  Spin,
  List,
  Tag,
  Radio,
  Input,
  Tooltip,
  Pagination,
  notification,
  Avatar,
  Checkbox,
  Select,
  Progress,
  Upload,
} from 'antd';
import { routerRedux } from 'dva/router';
import userUtil from '../../utils/user';
import PageHeaderLayout from '../../layouts/PageHeaderLayout';
import rainbondUtil from '../../utils/rainbond';

import styles from './index.less';

const { Search } = Input;

@connect(({ user, global }) => ({
  user: user.currentUser,
  rainbondInfo: global.rainbondInfo,
}))
export default class EnterpriseShared extends PureComponent {
  constructor(props) {
    super(props);
    const { user } = this.props;
    const enterpriseAdmin = userUtil.isCompanyAdmin(user);
    this.state = {
      enterpriseAdmin,
      fileList: [],
      existFileList: [],
      record: {},
      event_id: '',
      file_list: [],
      import_file_status: [],
      userTeamList: [],
      autoQuery: false,
      scopeValue: enterpriseAdmin ? 'enterprise' : 'team',
      tenant_name: '',
      percents: false,
    };
  }
  componentDidMount() {
    this.queryImportRecord();
    this.getUserTeams();
  }
  componentWillUnmount() {
    this.timer && clearTimeout(this.timer);
  }
  cancelImport = () => {
    this.props.dispatch({
      type: 'market/cancelImportApp',
      payload: {
        team_name: globalUtil.getCurrTeamName(),
        event_id: this.state.event_id,
      },
      callback: data => {
        if (data) {
          notification.success({ message: `取消成功` });
          this.props.cancelImport && this.props.cancelImport();
        }
      },
    });
  };
  complete = () => {
    this.props.onOK && this.props.onOK();
  };
  closeAutoQuery = () => {
    this.timer && clearTimeout(this.timer);
    this.setState({ autoQuery: false });
  };
  handleOk = () => {
    const file = this.state.fileList;
    if (file.length == 0) {
      notification.info({
        message: '您还没有上传文件',
      });
      return;
    }
    // file.map((item) => {
    //   if (item.status != "done") {
    //     notification.info({
    //       message: "正在上传请稍后"
    //     });
    //     return;
    //   }
    // })
    const file_name = file[0].name;
    const event_id = file[0].response.data.bean.event_id;
    this.props.dispatch({
      type: 'market/importApp',
      payload: {
        scope: 'enterprise',
        event_id,
        file_name,
      },
      callback: data => {
        if (data) {
          notification.success({ message: `操作成功，正在导入` });
          this.props.onOk && this.props.onOk(data);
        }
      },
    });
  };
  onChangeUpload = info => {
    const { autoQuery } = this.state;
    let fileList = info.fileList;
    fileList = fileList.filter(file => {
      if (file.response) {
        return file.response.msg === 'success';
      }
      return true;
    });

    if (info && info.event && info.event.percent) {
      this.setState({
        percents: info.event.percent,
      });
    }

    const status = info.file.status;
    if (status === 'done') {
      this.setState({
        percents: false,
      });
      // this.handleQueryImportDir(true);
      // this.closeAutoQuery();
    } else {
      !autoQuery && this.openAutoQuery();
    }

    this.setState({ fileList });
  };
  onRemove = () => {
    this.setState({ fileList: [] });
  };
  onFileChange = e => {
    this.setState({ file_list: e });
  };
  openAutoQuery = () => {
    this.setState({ autoQuery: true });
    this.handleQueryImportDir();
  };
  openQueryImportStatus = () => {
    this.queryImportStatus();
  };
  handleSubmit = () => {
    const {
      match: {
        params: { eid },
      },
    } = this.props;
    const { scopeValue, tenant_name, event_id, file_list } = this.state;
    if (file_list.length == 0) {
      notification.warning({
        message: '请至少选择一个应用',
      });
      return;
    }
    let fileStr = '';
    file_list.map(order => {
      fileStr += `${order},`;
    });
    fileStr = fileStr.slice(0, fileStr.length - 1);
    this.props.dispatch({
      type: 'market/importApp',
      payload: {
        scope: scopeValue,
        tenant_name,
        enterprise_id: eid,
        event_id,
        file_name: fileStr,
      },
      callback: data => {
        if (data) {
          notification.success({
            message: '开始导入应用',
          });
          this.closeAutoQuery();
          this.openQueryImportStatus();
        }
      },
    });
  };
  queryImportRecord = () => {
    const {
      dispatch,
      match: {
        params: { eid },
      },
    } = this.props;

    dispatch({
      type: 'market/queryImportRecord',
      payload: {
        enterprise_id: eid,
      },
      callback: res => {
        if (res) {
          this.setState(
            { record: res.bean, event_id: res.bean.event_id },
            () => {
              this.openQueryImportStatus();
              this.handleQueryImportDir(true);
            }
          );
        }
      },
    });
  };
  queryImportStatus = () => {
    const {
      dispatch,
      match: {
        params: { eid },
      },
    } = this.props;
    dispatch({
      type: 'market/queryImportApp',
      payload: {
        enterprise_id: eid,
        event_id: this.state.event_id,
      },
      callback: data => {
        if (data) {
          this.setState({ import_file_status: data.list });
          if (data.bean && data.bean.status == 'uploading') {
            return;
          }
          if (data.bean && data.bean.status == 'partial_success') {
            notification.success({
              message: '部分应用导入失败，你可以重试或取消导入',
            });
            return;
          }
          if (data.bean && data.bean.status == 'success') {
            notification.success({
              message: '导入完成',
            });

            dispatch(routerRedux.push(`/enterprise/${eid}/shared`));

            return;
          }
          if (data.bean && data.bean.status == 'failed') {
            notification.success({
              message: '应用导入失败',
            });
            return;
          }
          setTimeout(() => {
            this.queryImportStatus();
          }, 2000);
        }
      },
    });
  };

  handleQueryImportDir = isNext => {
    const {
      dispatch,
      match: {
        params: { eid },
      },
    } = this.props;
    const { autoQuery } = this.state;

    if (isNext || autoQuery) {
      dispatch({
        type: 'market/queryImportDirApp',
        payload: {
          enterprise_id: eid,
          event_id: this.state.event_id,
        },
        callback: data => {
          if (data) {
            this.setState({ existFileList: data.list });
          }
          const _th = this;
          if (autoQuery) {
            this.timer = setTimeout(function() {
              _th.handleQueryImportDir();
            }, 8000);
          }
        },
      });
    }
  };
  // reImportApp = file_name => {
  //   this.props.dispatch({
  //     type: 'market/importApp',
  //     payload: {
  //       tenant_name:this.state.tenant_name,
  //       enterprise_id: eid,
  //       scope: 'enterprise',
  //       event_id: this.state.event_id,
  //       file_name,
  //     },
  //     callback: data => {
  //       if (data) {
  //         notification.success({
  //           message: '开始重新导入',
  //         });
  //         this.openQueryImportStatus();
  //       }
  //     },
  //   });
  // };
  onChange = checkedValues => {
    console.log('checked = ', checkedValues);
  };

  onChangeRadio = e => {
    this.setState({
      scopeValue: e.target.value,
    });
  };

  getUserTeams = () => {
    const {
      dispatch,
      user,
      match: {
        params: { eid },
      },
    } = this.props;
    dispatch({
      type: 'global/fetchUserTeams',
      payload: {
        enterprise_id: eid,
        user_id: user.user_id,
        page: 1,
        page_size: 999,
      },
      callback: res => {
        if (res && res._code === 200) {
          this.setState({
            userTeamList: res.list,
          });
        }
      },
    });
  };

  handleChangeTeam = tenant_name => {
    this.setState({
      tenant_name,
    });
  };

  render() {
    const upSvg = () => (
      <svg
        t="1582646117495"
        viewBox="0 0 1026 1024"
        p-id="5405"
        width="23"
        height="23"
      >
        <path
          d="M536.149154 400.348544c56.251093 47.113428 112.500379 94.243113 168.749666 141.372797 20.850997 17.471561 22.241786 33.339199 4.763001 54.179359-17.460724 20.858222-33.353649 22.249011-54.20284 4.779257-34.630646-29.020528-69.259485-58.042862-103.906387-87.045328v448.330764c0 27.203471-11.259972 38.458025-38.477893 38.458024-27.201665 0-38.477893-11.254553-38.477894-38.458024V513.634629a541926.23157 541926.23157 0 0 0-103.906387 87.045328c-20.850997 17.469755-36.72586 16.078966-54.206452-4.779257-17.478786-20.84016-16.086191-36.707798 4.763001-54.179359 56.252899-47.129684 112.502185-94.259369 168.751472-141.372797 16.660568-13.953045 29.490145-13.953045 46.150713 0z"
          fill="#4D73B1"
          p-id="5406"
        />
        <path
          d="M923.532655 8.543418H102.61494C45.939386 8.543418 0 54.477385 0 111.113203v512.865179c0 56.632205 45.939386 102.569785 102.61494 102.569784h217.178022c27.216115 0 38.494149-11.272616 38.494149-38.476087 0-27.187215-11.276228-38.459831-38.494149-38.459831H102.61494c-18.148893 0-25.662766-7.506648-25.662766-25.63206V111.115009c0-18.125412 7.513873-25.633867 25.662766-25.633867h820.917715c18.148893 0 25.66096 7.508454 25.66096 25.633867v512.865179c0 18.125412-7.512067 25.63206-25.66096 25.63206H706.356439c-27.216115 0-38.494149 11.272616-38.494149 38.459831 0 27.205278 11.276228 38.476087 38.494149 38.476087h217.176216c56.675554 0 102.61494-45.93758 102.61494-102.569784V111.113203c0-56.635817-45.939386-102.569785-102.61494-102.569785z"
          fill="#4D73B1"
          p-id="5407"
        />
      </svg>
    );

    const appstatus = {
      pending: '等待中',
      importing: '导入中',
      success: '成功',
      failed: '失败',
    };
    const myheaders = {};
    const {
      existFileList,
      percents,
      userTeamList,
      enterpriseAdmin,
    } = this.state;
    const {
      rainbondInfo,
      match: {
        params: { eid },
      },
    } = this.props;

    const existFiles =
      existFileList && existFileList.length > 0 && existFileList;

    const radioStyle = {
      display: 'block',
      height: '30px',
      lineHeight: '30px',
    };
    const userTeam = userTeamList && userTeamList.length > 0 && userTeamList;

    return (
      <PageHeaderLayout
        title="离线应用模板导入"
        content="离线应用模板导入是创建本地共享库应用模型的方式之一，离线应用包可以来自其他Rainbond平台导出或云应用商店导出"
      >
        <div style={{ margin: '75px 21px 0 24px' }}>
          <div className={styles.tit}>离线应用模板导入</div>
          <Card
            bodyStyle={{ padding: '25px 0 25px 29px' }}
            className={styles.mb10}
          >
            <Row className={styles.box}>
              <Col span={24} className={styles.desc}>
                正在使用“阿里云上海”数据中心完成本次导入任务
              </Col>
            </Row>
          </Card>

          <Card bodyStyle={{ padding: '0 0 0 27px' }} className={styles.mb10}>
            <Row className={styles.box}>
              <Col span={23} className={styles.con}>
                上传RainbondAPP文件
                {percents && (
                  <Progress
                    percent={parseInt(percents)}
                    size="small"
                    style={{ width: '98%' }}
                  />
                )}
                {/* {this.state.import_file_status.length >= 0 ? (
                  <div>
                    {this.state.import_file_status.map(app => {
                      return (
                        <p style={{ lineHeight: '30px', paddingBottom: '5px' }}>
                          {app.file_name}
                          <span style={{ padding: '0 5px' }}>
                            {appstatus[app.status]}
                          </span>
                        </p>
                      );
                    })}
                  </div>
                ) : (
                  '上传RainbondAPP文件'
                )} */}
              </Col>
              <Col span={1} className={styles.rl}>
                <Upload
                  showUploadList={false}
                  name="appTarFile"
                  accept=".zip,.tar"
                  action={this.state.record.upload_url}
                  fileList={this.state.fileList}
                  onChange={this.onChangeUpload}
                  onRemove={this.onRemove}
                  headers={myheaders}
                >
                  <Icon component={upSvg} />
                  <div className={styles.upText}>上传</div>
                </Upload>
              </Col>
            </Row>
          </Card>

          {existFiles && (
            <div>
              <div className={styles.tit}>已上传文件列表</div>
              <Card className={styles.mb10}>
                <Checkbox.Group
                  style={{ width: '100%' }}
                  onChange={this.onFileChange}
                >
                  <Row>
                    {existFiles.map(order => {
                      return (
                        <Col key={`col${order}`} span={24}>
                          <Checkbox key={order} value={order}>
                            {order}
                          </Checkbox>
                        </Col>
                      );
                    })}
                  </Row>
                </Checkbox.Group>
              </Card>

              <div className={styles.tit}>导入范围</div>

              <Card className={styles.mb10}>
                <Radio.Group
                  onChange={this.onChangeRadio}
                  value={this.state.scopeValue}
                >
                  <Radio
                    style={radioStyle}
                    value="enterprise"
                    disabled={!enterpriseAdmin}
                  >
                    上传到企业
                  </Radio>
                  <Radio style={radioStyle} value="team">
                    上传到团队
                    <Select
                      size="small"
                      defaultValue="请选择一个团队"
                      style={{ width: 150, marginLeft: '15px' }}
                      onChange={this.handleChangeTeam}
                    >
                      {userTeam &&
                        userTeam.map(item => {
                          const { team_id, team_alias, team_name } = item;
                          return (
                            <Option key={team_id} value={team_name}>
                              {team_alias}
                            </Option>
                          );
                        })}
                    </Select>
                  </Radio>
                </Radio.Group>
              </Card>
              <Row style={{ marginTop: '25px' }}>
                <Col span={24} className={styles.btn}>
                  <Button
                    onClick={() => {
                      this.cancelImport();
                    }}
                  >
                    放弃导入
                  </Button>
                  {this.state.import_file_status.length == 0 && (
                    <Button
                      type="primary"
                      onClick={() => {
                        this.handleSubmit();
                      }}
                    >
                      确认导入
                    </Button>
                  )}
                </Col>
              </Row>
            </div>
          )}
        </div>
      </PageHeaderLayout>
    );
  }
}
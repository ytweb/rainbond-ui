/* eslint-disable no-nested-ternary */
import {
  Button,
  Divider,
  Form,
  Icon,
  Input,
  Modal,
  Radio,
  Select,
  Spin,
  Upload
} from 'antd';
import { connect } from 'dva';
import React, { Fragment, PureComponent } from 'react';
import apiconfig from '../../../config/api.config';
import { fetchAppModelsTags, fetchOrganizations } from '../../services/market';
import cookie from '../../utils/cookie';
import userUtil from '../../utils/user';
import styles from '../CreateTeam/index.less';

const FormItem = Form.Item;
const { Option } = Select;
const { TextArea } = Input;

@Form.create()
@connect(({ user, global, teamControl }) => ({
  user: user.currentUser,
  rainbondInfo: global.rainbondInfo,
  currentTeam: teamControl.currentTeam
}))
class CreateAppModels extends PureComponent {
  constructor(props) {
    super(props);
    const { user } = this.props;
    const adminer = userUtil.isCompanyAdmin(user);
    this.state = {
      isShared: window.location.href.indexOf('shared') > -1,
      previewImage: '',
      previewVisible: false,
      tagList: [],
      imageBase64: '',
      imageUrl: props.appInfo ? props.appInfo.pic : '',
      loading: false,
      submitLoading: false,
      page: 1,
      page_size: 10,
      adminer,
      teamList: [],
      organizations: [],
      organizationsLoading: true,
      tagLoading: true,
      isAddLicense: false,
      enterpriseTeamsLoading: true
    };
  }
  componentDidMount() {
    this.getTags();
    const { isShared, adminer } = this.state;
    if (isShared && adminer) {
      this.getEnterpriseTeams();
    }
    this.fetchOrganizations();
  }
  getTags = () => {
    const { eid } = this.props;
    fetchAppModelsTags({
      enterprise_id: eid
    })
      .then(res => {
        this.setState({
          tagList: (res && res.list) || []
        });
      })
      .finally(() => {
        this.handleTagLoading(false);
      });
  };

  getBase64 = file => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  getLogoBase64 = (img, callback) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => callback(reader.result));
    reader.readAsDataURL(img);
  };

  getEnterpriseTeams = name => {
    const { dispatch, eid } = this.props;
    const { page, page_size } = this.state;
    dispatch({
      type: 'global/fetchEnterpriseTeams',
      payload: {
        name,
        page,
        page_size,
        enterprise_id: eid
      },
      callback: res => {
        if (res && res.status_code === 200) {
          if (res.bean && res.bean.list) {
            const listNum = (res.bean && res.bean.total_count) || 0;
            const isAdd = !!(listNum && listNum > page_size);

            this.setState({
              teamList: res.bean.list,
              isAddLicense: isAdd,
              enterpriseTeamsLoading: false
            });
          }
        }
      }
    });
  };
  addTeams = () => {
    this.setState(
      {
        enterpriseTeamsLoading: true,
        page_size: this.state.page_size + 10
      },
      () => {
        this.getEnterpriseTeams();
      }
    );
  };
  handleSubmit = () => {
    const { form, appInfo } = this.props;
    form.validateFields((err, values) => {
      if (!err) {
        this.handleSubmitLoading(true);
        if (appInfo) {
          this.upAppModel(values);
        } else {
          this.createAppModel(values);
        }
      }
    });
  };

  handleLogoChange = info => {
    if (info.file.status === 'uploading') {
      this.setState({ loading: true });
      return;
    }
    if (info.file.status === 'done') {
      this.setState({
        imageUrl:
          info.file &&
          info.file.response &&
          info.file.response.data &&
          info.file.response.data.bean &&
          info.file.response.data.bean.file_url,
        loading: false
      });

      this.getLogoBase64(info.file.originFileObj, imageBase64 =>
        this.setState({
          imageBase64
        })
      );
    }
  };

  handleLogoRemove = () => {
    this.setState({ imageUrl: '', imageBase64: '' });
  };
  handlePreview = async file => {
    if (!file.url && !file.preview) {
      file.preview = await this.getBase64(file.originFileObj);
    }
    this.setState({
      previewImage: file.url || file.preview,
      previewVisible: true
    });
  };

  handleCancel = () => this.setState({ previewVisible: false });

  handleClose = removedTagID => {
    const tagList = this.state.tagList.filter(
      item => item.tag_id !== removedTagID
    );
    this.setState({ tagList });
  };

  handleSubmitLoading = loading => {
    this.setState({
      submitLoading: loading
    });
  };

  handleTagLoading = loading => {
    this.setState({
      tagLoading: loading
    });
  };

  createTag = name => {
    const { dispatch, eid } = this.props;
    dispatch({
      type: 'market/createTag',
      payload: {
        enterprise_id: eid,
        name
      },
      callback: res => {
        if (res && res.status_code === 200) {
          this.getTags();
        }
      }
    });
  };

  fetchOrganizations = () => {
    const { eid, marketId, marketVersion } = this.props;
    if (marketId && marketVersion && marketVersion === '2.0') {
      fetchOrganizations({
        market_id: marketId,
        enterprise_id: eid
      })
        .then(res => {
          this.setState({
            organizations: (res && res.list) || []
          });
        })
        .finally(() => {
          this.handleOrganizationsLoading(false);
        });
    } else {
      this.handleOrganizationsLoading(false);
    }
  };
  handleOrganizationsLoading = loading => {
    this.setState({
      organizationsLoading: loading
    });
  };
  upAppModel = values => {
    const { dispatch, eid, appInfo, onOk, team_name } = this.props;
    const { imageUrl, tagList, isShared } = this.state;

    const arr = [];
    if (
      values.tag_ids &&
      values.tag_ids.length > 0 &&
      tagList &&
      tagList.length > 0
    ) {
      values.tag_ids.map(items => {
        tagList.map(item => {
          if (items === item.name) {
            arr.push(parseFloat(item.tag_id));
          }
        });
      });
    }

    const body = {
      enterprise_id: eid,
      name: values.name,
      pic: imageUrl,
      tag_ids: arr,
      app_id: appInfo.app_id,
      dev_status: values.dev_status ? 'release' : '',
      describe: values.describe,
      scope: isShared && values.scope !== 'enterprise' ? 'team' : values.scope
    };
    if (team_name) {
      body.create_team = team_name;
    } else if (isShared && values.scope !== 'enterprise') {
      body.create_team = values.scope;
    }
    dispatch({
      type: 'market/upAppModel',
      payload: body,
      callback: res => {
        if (res && res.status_code === 200 && onOk) {
          onOk(appInfo);
        }
        this.handleSubmitLoading(false);
      }
    });
  };

  createAppModel = values => {
    const { dispatch, eid, onOk, currentTeam, marketId } = this.props;
    const { imageUrl, tagList, isShared } = this.state;
    const arr = [];
    const tags = [];
    if (
      values.tag_ids &&
      values.tag_ids.length > 0 &&
      tagList &&
      tagList.length > 0
    ) {
      values.tag_ids.map(items => {
        tagList.map(item => {
          if (items === item.name) {
            tags.push(item.name);
            arr.push(parseFloat(item.tag_id));
          }
        });
      });
    }

    let customBody = {};

    if (marketId) {
      customBody = {
        enterprise_id: eid,
        marketName: marketId,
        name: values.name,
        org_id: values.org_id,
        logo: imageUrl,
        introduction: '',
        app_classification_id: '',
        team_name: currentTeam && currentTeam.team_name,
        desc: values.describe,
        publish_type: 'private',
        tags
      };

      dispatch({
        type: 'market/createMarketAppModel',
        payload: customBody,
        callback: res => {
          if (res && res.status_code === 200 && onOk) {
            onOk();
          }
          this.handleSubmitLoading(false);
        }
      });
      return null;
    }
    customBody = {
      enterprise_id: eid,
      name: values.name,
      pic: imageUrl,
      scope: isShared && values.scope !== 'enterprise' ? 'team' : values.scope,
      team_name: currentTeam && currentTeam.team_name,
      dev_status: values.dev_status,
      describe: values.describe,
      tag_ids: arr
    };

    if (isShared && values.scope !== 'enterprise') {
      customBody.create_team = values.scope;
    }

    dispatch({
      type: 'market/createAppModel',
      payload: customBody,
      callback: res => {
        if (res && res.status_code === 200 && onOk) {
          onOk();
        }
        this.handleSubmitLoading(false);
      }
    });
  };

  handleOnSelect = value => {
    const { tagList } = this.state;
    if (value && tagList.length > 0) {
      let judge = true;
      tagList.map(item => {
        if (item.name === value) {
          judge = false;
        }
      });

      if (judge) {
        this.createTag(value);
      }
    } else if (tagList && tagList.length === 0) {
      this.createTag(value);
    }
  };

  render() {
    const { getFieldDecorator } = this.props.form;
    const {
      onCancel,
      title,
      appInfo,
      defaultScope,
      marketId,
      appName,
      marketVersion
    } = this.props;
    const {
      loading,
      imageUrl,
      previewImage,
      previewVisible,
      tagList,
      tagLoading,
      imageBase64,
      teamList,
      isAddLicense,
      isShared,
      enterpriseTeamsLoading,
      organizationsLoading,
      organizations,
      submitLoading
    } = this.state;

    const formItemLayout = {
      labelCol: {
        xs: { span: 24 },
        sm: { span: 5 }
      },
      wrapperCol: {
        xs: { span: 24 },
        sm: { span: 19 }
      }
    };
    const arr = [];

    if (
      appInfo &&
      appInfo.tags &&
      appInfo.tags.length > 0 &&
      tagList &&
      tagList.length > 0
    ) {
      appInfo.tags.map(items => {
        arr.push(items.name);
      });
    }

    const token = cookie.get('token');
    const myheaders = {};
    if (token) {
      myheaders.Authorization = `GRJWT ${token}`;
    }
    const uploadButton = (
      <div>
        <Icon type={loading ? 'loading' : 'plus'} />
        <div className="ant-upload-text">上传图标</div>
      </div>
    );

    return (
      <div>
        <Modal
          visible={previewVisible}
          footer={null}
          onCancel={this.handleCancel}
        >
          <img alt="example" style={{ width: '100%' }} src={previewImage} />
        </Modal>
        <Modal
          title={title}
          visible
          width={500}
          className={styles.TelescopicModal}
          onOk={this.handleSubmit}
          onCancel={onCancel}
          footer={
            <Fragment>
              <Button onClick={onCancel}> 取消 </Button>
              <Button
                type="primary"
                disabled={organizationsLoading || tagLoading}
                onClick={this.handleSubmit}
                loading={submitLoading}
              >
                确定
              </Button>
            </Fragment>
          }
        >
          <Spin spinning={organizationsLoading || tagLoading}>
            <Form onSubmit={this.handleSubmit} layout="horizontal">
              <FormItem {...formItemLayout} label="名称">
                {getFieldDecorator('name', {
                  initialValue: appName || (appInfo ? appInfo.app_name : ''),
                  rules: [
                    {
                      required: true,
                      message: '请输入名称'
                    },
                    {
                      max: 32,
                      message: '最大长度32位'
                    },
                    {
                      pattern: /^[a-z0-9A-Z\u4e00-\u9fa5]([a-zA-Z0-9_\-\u4e00-\u9fa5]*[a-z0-9A-Z\u4e00-\u9fa5])?$/,
                      message:
                        '只支持中文、字母、数字和-_组合，并且必须以中文、字母、数字开始和结束'
                    }
                  ]
                })(<Input placeholder="请输入名称" />)}
                <div className={styles.conformDesc}>
                  请输入创建的应用模版名称，最大长度32位.
                </div>
              </FormItem>
              {!marketId && (
                <FormItem {...formItemLayout} label="发布范围">
                  {getFieldDecorator('scope', {
                    initialValue: appInfo
                      ? isShared && appInfo.scope && appInfo.scope === 'team'
                        ? appInfo.create_team
                        : appInfo.scope
                      : defaultScope || 'enterprise',
                    rules: [
                      {
                        required: true,
                        message: '请输入名称'
                      }
                    ]
                  })(
                    isShared ? (
                      <Select
                        getPopupContainer={triggerNode =>
                          triggerNode.parentNode
                        }
                        placeholder="请选择发布范围"
                        dropdownRender={menu => (
                          <div>
                            {menu}
                            {isAddLicense && (
                              <div>
                                <Divider style={{ margin: '4px 0' }} />
                                {enterpriseTeamsLoading ? (
                                  <Spin size="small" />
                                ) : (
                                  <div
                                    style={{
                                      padding: '4px 8px',
                                      cursor: 'pointer'
                                    }}
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => {
                                      this.addTeams();
                                    }}
                                  >
                                    <Icon type="plus" /> 加载更多
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      >
                        <Option value="enterprise" key="enterprise">
                          <div style={{ borderBottom: '1px solid #ccc' }}>
                            当前企业
                          </div>
                        </Option>

                        {teamList &&
                          teamList.map(item => {
                            return (
                              <Option
                                key={item.team_name}
                                value={item.team_name}
                              >
                                {item.team_alias}
                              </Option>
                            );
                          })}
                      </Select>
                    ) : (
                      <Radio.Group name="scope">
                        <Radio value="team">当前团队</Radio>
                        <Radio value="enterprise">企业</Radio>
                      </Radio.Group>
                    )
                  )}
                  <div className={styles.conformDesc}>发布模型的可视范围</div>
                </FormItem>
              )}
              {marketId && marketVersion && marketVersion === '2.0' && (
                <FormItem {...formItemLayout} label="行业名称">
                  {getFieldDecorator('org_id', {
                    rules: [
                      {
                        required: true,
                        message: '请选择行业'
                      }
                    ]
                  })(
                    <Select placeholder="请选择行业">
                      {organizations &&
                        organizations.length > 0 &&
                        organizations.map(item => {
                          return (
                            <Option value={item.org_id}>{item.name}</Option>
                          );
                        })}
                    </Select>
                  )}
                </FormItem>
              )}
              <Form.Item {...formItemLayout} label="分类标签">
                {getFieldDecorator('tag_ids', {
                  initialValue: arr,
                  rules: [
                    {
                      required: false,
                      message: '请添加标签'
                    }
                  ]
                })(
                  <Select
                    getPopupContainer={triggerNode => triggerNode.parentNode}
                    mode="tags"
                    style={{ width: '100%' }}
                    onSelect={this.handleOnSelect}
                    tokenSeparators={[',']}
                    placeholder="请选择分类标签"
                  >
                    {tagList.map(item => {
                      const { tag_id, name } = item;
                      return (
                        <Option key={tag_id} value={name} label={name}>
                          {name}
                        </Option>
                      );
                    })}
                  </Select>
                )}
              </Form.Item>
              <FormItem {...formItemLayout} label="简介">
                {getFieldDecorator('describe', {
                  initialValue: appInfo
                    ? appInfo.describe || appInfo.app_describe
                    : '',
                  rules: [
                    {
                      required: false,
                      message: '请输入简介'
                    }
                  ]
                })(<TextArea placeholder="请输入简介" />)}
                <div className={styles.conformDesc}>
                  请输入创建的应用模版简介
                </div>
              </FormItem>
              <Form.Item {...formItemLayout} label="LOGO">
                {getFieldDecorator('pic', {
                  initialValue: appInfo ? appInfo.pic : '',
                  rules: [
                    {
                      required: false,
                      message: '请上传图标'
                    }
                  ]
                })(
                  <Upload
                    className="logo-uploader"
                    name="file"
                    accept="image/jpg,image/jpeg,image/png"
                    action={apiconfig.imageUploadUrl}
                    listType="picture-card"
                    headers={myheaders}
                    showUploadList={false}
                    onChange={this.handleLogoChange}
                    onRemove={this.handleLogoRemove}
                    onPreview={this.handlePreview}
                  >
                    {imageUrl ? (
                      <img
                        src={imageBase64 || imageUrl}
                        alt="avatar"
                        style={{ width: '100%' }}
                      />
                    ) : (
                      uploadButton
                    )}
                  </Upload>
                )}
              </Form.Item>
            </Form>
          </Spin>
        </Modal>
      </div>
    );
  }
}

export default CreateAppModels;

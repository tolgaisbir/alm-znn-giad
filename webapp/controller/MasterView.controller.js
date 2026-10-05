sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/Device",
    "sap/ndc/BarcodeScanner",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v2/ODataModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/core/BusyIndicator",
    "zfiorigid/utils/formatter"
], (Controller, Device, BarcodeScanner, JSONModel, ODataModel, MessageToast, MessageBox, Filter, BusyIndicator, formatter) => {
    "use strict";

    return Controller.extend("zfiorigid.controller.MasterView", {
        formatter: formatter,

        onInit() {
            // When navigation completes - try focusing
            const that = this;
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteMasterView").attachPatternMatched(this._onRouteMatched, this);
            const oInput = this.byId("_IDGenButton010");

            if (Device.system.phone) {
                oInput.setWidth("100%");
            } else {
                oInput.setWidth("30%");
            }

            const view = this.getView();
            const model = new JSONModel();
            const inputModel = new JSONModel();
            model.setSizeLimit(1000);
            view.setModel(model, "postModel");
            view.setModel(inputModel, "inputModel");

            let sUrl = "/sap/opu/odata/sap/ZMZ_GOOD_ISSUE_SRV/";
            this.oDataModel = new ODataModel(sUrl);

            const payload = {
                "IvCall": "DEL",
                "IvJson": ""
            }
            this.toggleBusy(true);
            this.oDataModel.create("/SaveSet", payload, {
                success: function (success) {
                    if (success.EvJson) {
                        const result = JSON.parse(success.EvJson);
                        if (result.DELIVERY !== "" || result.ITEM.length > 0) {
                            that.getView().getModel("inputModel").setData({ Delivery: result.DELIVERY });
                            result.ITEM.forEach((item, index) => {
                                item.ITEMNO = index + 1,
                                    item.MATNR = (+item.MATNR).toString();
                                let batchQty = 0.0;
                                item.LINE.forEach((batch, index) => {
                                    batch.SR_NO = index + 1;
                                    batchQty = batchQty + parseFloat(batch.BATCHQTY);
                                })
                            })
                            let model = that.getView().getModel("postModel");
                            model.setData(result);
                            model.refresh();
                        }
                        that.toggleBusy(false);
                    }
                    const oInput = that.byId("_IDGenButton010");
                    if (oInput) {
                        oInput.focus();
                    }
                },
                error: function (error) {
                    try {
                        const responseText = JSON.parse(error.responseText);
                        const errors = responseText?.error?.innererror?.errordetails || [];
                        that.toggleBusy(false);
                        if (errors.length > 0) {
                            const errMessages = errors.map(e => e.message).join("\n");
                            MessageBox.error(`${errMessages}`);
                        } else {
                            const message = responseText?.error?.message?.value || "Unknown Error";
                            MessageBox.error(`${message}`);
                        }
                    } catch (parseError) {
                        that.toggleBusy(false);
                        const errors = error.responseText.split("<message>");
                        if (errors.length) MessageBox.error(`${errors[0]}:${errors[1]}`);
                        else MessageBox.error(`Unkown Error!\n${parseError}`);
                    }
                }
            });
        },

        _onRouteMatched: function () {
            setTimeout(() => {
                const oInput = this.byId("_IDGenButton010");
                if (oInput) {
                    oInput.focus();
                }
            }, 200); // 200�400ms is safest
        },

        onPressEnter: function (oEvent) {
            const inputValue = oEvent.getParameter("value");
            if (inputValue !== '') {
                const status = this._delScanCheck();
                if (status) {
                    MessageToast.show("Pending deliveries need to be completed!");
                    return;
                }
                this.toggleBusy(true, this.byId("idMaterialTable"));
                this.setScanData(inputValue);
            }
        },

        onBarcodeScan: function () {
            const that = this;
            BarcodeScanner.scan(
                function (oResult) {
                    if (oResult.text && oResult.text !== '') {
                        const status = that._delScanCheck();
                        if (status) {
                            MessageToast.show("Pending deliveries need to be completed!");
                            return;
                        }
                        that.toggleBusy(true, that.byId("idMaterialTable"));
                        that.setScanData(oResult.text);
                    } else {
                        MessageToast.show("No QR code data found");
                    }
                },
                function (error) {
                    MessageToast.show("No QR code data found");
                });
        },

        _delScanCheck: function () {
            const itemData = this.getView().getModel("postModel").getData();
            const status = itemData?.ITEM?.some(item => item.STATUS !== 'Completed');
            return status;
        },

        setScanData: function (scanText) {
            const that = this;
            const payload = {
                "IvCall": "GET",
                "IvJson": scanText
            }
            this.getView().getModel("inputModel").setData({ Delivery: scanText });
            const sPath = "/SaveSet";
            that.oDataModel.create(sPath, payload, {
                success: function (success) {
                    if (success.EvJson) {
                        const result = JSON.parse(success.EvJson);
                        if (result.DELIVERY !== "" || result.ITEM.length > 0) {
                            result.ITEM.map((item, index) => {
                                item.ITEMNO = index + 1,
                                    item.MATNR = (+item.MATNR).toString();
                                that._formatStatusText(item);
                                let batchQty = 0.0;
                                item.LINE.forEach((batch, index) => {
                                    batch.SR_NO = index + 1;
                                    batchQty = batchQty + parseFloat(batch.BATCHQTY);
                                })
                            })
                            let model = that.getView().getModel("postModel");
                            model.setData(result);
                            model.refresh();
                            that.toggleBusy(false, that.byId("idMaterialTable"));
                        } else {
                            that.toggleBusy(false, that.byId("idMaterialTable"));
                            MessageToast.show("No Data Found!");
                        }
                    }
                },
                error: function (error) {
                    try {
                        const responseText = JSON.parse(error.responseText);
                        const errors = responseText?.error?.innererror?.errordetails || [];
                        that.toggleBusy(false, that.byId("idMaterialTable"));
                        if (errors.length > 0) {
                            const errMessages = errors.map(e => e.message).join("\n");
                            MessageBox.error(`${errMessages}`);
                        } else {
                            const message = responseText?.error?.message?.value || "Unknown Error";
                            MessageBox.error(`${message}`);
                        }
                    } catch (error) {
                        that.toggleBusy(false, that.byId("idMaterialTable"));
                        MessageBox.error(`Unkown Error!\n${error}`);
                    }
                }
            });
        },

        _formatStatusText: function (oItem) {
            if (oItem.PICKED_QTY === 0) oItem.STATUS = "Open";
            else if (oItem.PICKED_QTY === oItem.QTY) oItem.STATUS = "Completed";
            else oItem.STATUS = "Partial";
        },

        onClick: function (oEvent) {
            var view = this.getView();
            var oRow = oEvent.getParameter('listItem').getBindingContext('postModel').sPath.split('/')[2];
            var oObject = {
                Row: oRow
            }
            var oRowModel = new JSONModel(oObject);
            view.setModel(oRowModel, "oRowModel");

            if (!this.oDialog) {
                this.oDialog = sap.ui.xmlfragment("zfiorigid.view.Dialog", this);
                this.getView().addDependent(this.oDialog);
            }
            this.oDialog.open();
            const oInput = sap.ui.getCore().byId("_IDGenButtonScn");
            const oDialog = sap.ui.getCore().byId("_IDGenDialog");
            if (Device.system.phone) {
                oInput.setWidth("100%");
                oDialog.setContentWidth("100%");
            } else {
                oInput.setWidth("25%");
                oDialog.setContentWidth("50%");
            }
            setTimeout(() => {
                oInput.focus();
            }, 500);

            this.toggleBusy(true);
            let dialogTable = sap.ui.getCore().byId("_IDGenTable");
            if (!this.oTemplate) {
                this.oTemplate = new sap.m.ColumnListItem({
                    cells: [
                        new sap.m.Text({ text: "{postModel>SR_NO}" }),
                        new sap.m.ObjectIdentifier({ title: "{postModel>BATCH}" }),
                        new sap.m.Text({
                            text: {
                                path: 'postModel>BATCHQTY',
                                type: 'sap.ui.model.type.Float',
                                formatOptions: {
                                    minFractionDigits: 2,
                                    maxFractionDigits: 2,
                                    groupingEnabled: true
                                }
                            }
                        })
                    ]
                });
            }
            dialogTable.bindItems({
                path: 'postModel>/ITEM/' + oRow + '/LINE/',
                template: this.oTemplate
            });
            dialogTable.selectAll();

            var itemQty = sap.ui.getCore().byId("itemQty");
            var itemModel = this.getView().getModel("postModel");
            itemQty.setText(this.formatter.formatQuantity(itemModel.getData().ITEM[oRow].QTY));
            let pickedQty = sap.ui.getCore().byId("_IDGenText11");
            // let pickedBatchQty = 0;
            // itemModel.getData().ITEM[oRow].LINE?.forEach(batch => {
            //     pickedBatchQty = pickedBatchQty + batch.BATCHQTY;
            // });
            // pickedBatchQty !== 0 ? pickedQty.setText(this.formatter.formatQuantity(pickedBatchQty)) : pickedQty.setText("0");
            let pickedBatchQty = itemModel.getData().ITEM[oRow].PICKED_QTY;
            pickedBatchQty !== 0 ? pickedQty.setText(this.formatter.formatQuantity(pickedBatchQty)) : pickedQty.setText("0");
            this.toggleBusy(false);
        },

        onDialogClose() {
            this.oDialog.close();
            this.getView().getModel("postModel").refresh();
        },

        onQRPressEnter: function (oEvent) {
            const inputValue = oEvent.getParameter("value");
            if (inputValue !== '') {
                if (inputValue.includes('/')) {
                    this._QRDataSplit(inputValue);
                } else {
                    this._verifyBatch({
                        OrderNo: '',
                        Matnr: '',
                        MatDesc: '',
                        Batch: inputValue,
                        Quantity: ''
                    })
                }
            }
            oEvent.getSource().setValue();
        },

        onQtyScan: function () {
            var that = this;
            BarcodeScanner.scan(
                function (oResult) {
                    if (oResult.text && oResult.text !== '') {
                        if (oResult.text.includes("/")) {
                            that._QRDataSplit(oResult.text);
                        } else {
                            that._verifyBatch({
                                OrderNo: '',
                                Matnr: '',
                                MatDesc: '',
                                Batch: oResult.text,
                                Quantity: ''
                            });
                        }
                    } else {
                        MessageToast.show("No QRcode data found");
                    }
                },
                function (error) {
                    MessageToast.show("No QRcode data found");
                });
        },

        _QRDataSplit: function (batchQR) {
            const qrArray = batchQR.split("/");
            if (qrArray.length === 4) {
                this._verifyBatch({
                    OrderNo: '',
                    Matnr: qrArray[0],
                    MatDesc: '',
                    Batch: qrArray[2],
                    Quantity: ''
                });
            } else if (qrArray.length === 5) {
                this._verifyBatch({
                    OrderNo: qrArray[0],
                    Matnr: qrArray[1],
                    MatDesc: qrArray[2],
                    Batch: qrArray[3],
                    Quantity: qrArray[4]
                });
            }
        },

        _verifyBatch: function (batchObject) {
            var that = this;
            var oRow = this.getView().getModel("oRowModel").getData().Row,
                rowData = this.getView().getModel("postModel").getData().ITEM[oRow],
                deliveryNo = this.getView().getModel("postModel").getData().DELIVERY,
                matnr = rowData.MATNR,
                lotNo = rowData.LOT_NO;
            let material = batchObject.Matnr;
            matnr = +matnr;
            material ? material = +material : material = matnr;

            if (matnr === material) {
                // const isBatchDuplicate = rowData.LINE.some(obj => obj.BATCH == batchObject.Batch);
                // if (isBatchDuplicate) { MessageToast.show("Duplicate Batch!"); return; }

                let filters = [];
                filters.push(new Filter("Matnr", "EQ", material));
                filters.push(new Filter("BatchMatnr", "EQ", batchObject.Batch));
                filters.push(new Filter("LotNo", "EQ", lotNo));
                filters.push(new Filter("Delivery", "EQ", deliveryNo));
                that.toggleBusy(true, sap.ui.getCore().byId("_IDGenTable"));
                that.oDataModel.read('/batchitemSet', {
                    filters: filters,
                    success: function (success) {
                        var table = sap.ui.getCore().byId("_IDGenTable");
                        if (!success.results || success.results.length === 0) {
                            that.toggleBusy(false, table);
                            MessageToast.show("No QRcode data found");
                            return;
                        }

                        // SINGLE batch scan rules
                        if (success.results.length === 1) {
                            const singleResult = success.results[0];

                            // Lot mismatch
                            if (singleResult.Flag === 'X') {
                                that.toggleBusy(false, table);
                                MessageToast.show("Lot# Mismatch!");
                                return;
                            }

                            // Duplicate batch
                            const isDuplicateSingle = rowData.LINE.some(
                                row => row.BATCH == singleResult.BatchMatnr
                            );
                            if (isDuplicateSingle) {
                                that.toggleBusy(false, table);
                                MessageToast.show("Duplicate Batch!");
                                return;
                            }
                        }

                        let pickedQtyText = sap.ui.getCore().byId("_IDGenText11"),
                            pickedQtyValue = that.formatter.valueParse(pickedQtyText.getText()),
                            runningQty = pickedQtyValue,
                            qtyExceeded = false;

                        // MULTI batch (pallet) or valid single batch
                        for (let i = 0; i < success.results.length; i++) {
                            const oResult = success.results[i];
                            // Skip invalid or lot-mismatch batches in pallet scan
                            if (oResult.Flag === 'X' || !oResult.BatchMatnr) {
                                continue;
                            }
                            // Skip duplicates silently in pallet scan
                            const isDuplicate = rowData.LINE.some(
                                row => row.BATCH == oResult.BatchMatnr
                            );
                            if (isDuplicate) {
                                continue;
                            }
                            const batchQty = that.formatter.valueParse(oResult.BatchQty);
                            // HARD STOP on quantity overflow
                            if ((runningQty + batchQty) > rowData.QTY) {
                                qtyExceeded = true;
                                break;
                            }
                            rowData.LINE.push({
                                SR_NO: rowData.LINE.length + 1,
                                BATCH: oResult.BatchMatnr,
                                BATCHQTY: oResult.BatchQty,
                                MATNR: material
                            });
                            runningQty += batchQty;
                        }

                        // Update UI
                        pickedQtyText.setText(that.formatter.formatQuantity(runningQty));
                        rowData.PICKED_QTY = runningQty;
                        that._formatStatusText(rowData);

                        table.bindItems({
                            path: 'postModel>/ITEM/' + oRow + '/LINE/',
                            template: that.oTemplate
                        });

                        table.selectAll();
                        that.toggleBusy(false, table);
                        that.onHold();

                        if (qtyExceeded) {
                            MessageToast.show("Item quantity exceeded!");
                        }
                    },
                    error: function (error) {
                        try {
                            const responseText = JSON.parse(error.responseText);
                            const errors = responseText?.error?.innererror?.errordetails || [];
                            that.toggleBusy(false, sap.ui.getCore().byId("_IDGenTable"));
                            if (errors.length > 0) {
                                const errMessages = errors.map(e => e.message).join("\n");
                                MessageBox.error(`${errMessages}`);
                            } else {
                                const message = responseText?.error?.message?.value || "Unknown Error";
                                MessageBox.error(`${message}`);
                            }
                        } catch (parseError) {
                            that.toggleBusy(false, sap.ui.getCore().byId("_IDGenTable"));
                            if (error.response?.body) {
                                const errors = error.response.body.split("message");
                                if (errors.length > 1) MessageBox.error(`${errors[1]}`);
                            } else {
                                const errors = error.responseText.split("message");
                                if (errors.length > 1) MessageBox.error(`${errors[1]}`);
                                else if (errors.length == 1) MessageBox.error(`${errors[0]}`);
                                else MessageBox.error(`Unkown Error!`);
                            }
                        }
                    }
                })
            } else {
                MessageToast.show("Material mismatch!");
            }
        },

        onConfirm: function () {
            this.toggleBusy(true);
            Promise.resolve().then(() => {
                if (sap.ui.getCore().byId("_IDGenTable").getItems().length > 0) {
                    let selectedBatchData = [];
                    let selectedBatches = sap.ui.getCore().byId("_IDGenTable").getSelectedItems();
                    if (!selectedBatches.length) {
                        this.toggleBusy(false);
                        MessageToast.show("No batch selected!");
                        return;
                    }

                    selectedBatches.forEach(batch => {
                        const context = batch.getBindingContext("postModel");
                        if (context) selectedBatchData.push(context.getObject());
                    });
                    let postModel = this.getView().getModel('postModel');
                    var oRow = this.getView().getModel('oRowModel').getData().Row;
                    var rowData = postModel.getData().ITEM[oRow];
                    rowData.LINE = selectedBatchData;

                    let batchQty = 0.0,
                        pickedQty = sap.ui.getCore().byId("_IDGenText11");
                    rowData.LINE.forEach(row => {
                        batchQty = batchQty + parseFloat(row.BATCHQTY);
                    });
                    pickedQty.setText(this.formatter.formatQuantity(batchQty));
                    rowData.PICKED_QTY = batchQty;
                    this._formatStatusText(rowData);

                    postModel.refresh();
                    this.oDialog.close();
                    this.onPost();
                }
            })
        },

        onHold: function () {
            const that = this;
            const postData = this.getView().getModel("postModel").getData();
            // const oRow = this.getView().getModel("oRowModel").getData().Row;
            // const postData = {
            //     DELIVERY: delivData.DELIVERY,
            //     FLAG: delivData.FLAG,
            //     ITEM: [delivData.ITEM[oRow]],
            //     MAT_DOC: "",
            //     ORDER_ITEM: delivData.ORDER_ITEM,
            //     SALES_ORDER: delivData.SALES_ORDER
            // }
            // let payload = JSON.stringify(postData);
            let payload = JSON.stringify(postData);
            let oSave = {
                "IvCall": "HOLD",
                "IvJson": payload
            }
            this.toggleBusy(true);
            this.oDataModel.create("/SaveSet", oSave, {
                success: function (oData) {
                    that.toggleBusy(false);
                },
                error: function (error) {
                    try {
                        const responseText = JSON.parse(error.responseText);
                        const errors = responseText?.error?.innererror?.errordetails || [];
                        that.toggleBusy(false);
                        if (errors.length > 0) {
                            const errMessages = errors.map(e => e.message).join("\n");
                            MessageBox.error(`${errMessages}`);
                        } else {
                            const message = responseText?.error?.message?.value || "Unknown Error";
                            MessageBox.error(`${message}`);
                        }
                    } catch (parseError) {
                        that.toggleBusy(false);
                        const errors = error.responseText.split("<message>");
                        if (errors.length) MessageBox.error(`${errors[0]}:${errors[1]}`);
                        else MessageBox.error(`Unkown Error!\n${parseError}`);
                    }
                }
            });
        },

        onPost: function () {
            const that = this;
            const delivData = this.getView().getModel("postModel").getData();
            const oRow = this.getView().getModel("oRowModel").getData().Row;
            const postData = {
                DELIVERY: delivData.DELIVERY,
                FLAG: delivData.FLAG,
                ITEM: [delivData.ITEM[oRow]],
                MAT_DOC: "",
                ORDER_ITEM: delivData.ORDER_ITEM,
                SALES_ORDER: delivData.SALES_ORDER,
                POSNR: delivData.POSNR
            }
            let payload = JSON.stringify(postData);
            let oSave = {
                "IvCall": "SAVE",
                "IvJson": payload
            }
            this.oDataModel.create("/SaveSet", oSave, {
                success: function (oData) {
                    that.toggleBusy(false);
                    if (oData.EvJson) {
                        MessageBox.error(oData.EvJson);
                    } else {
                        MessageToast.show("Success!");
                    }
                },
                error: function (error) {
                    try {
                        that.toggleBusy(false);
                        const responseText = JSON.parse(error.responseText);
                        const errors = responseText?.error?.innererror?.errordetails || [];
                        if (errors.length > 0) {
                            const errMessages = errors.map(e => e.message).join("\n");
                            MessageBox.error(`${errMessages}`);
                        } else {
                            const message = responseText?.error?.message?.value || "Unknown Error";
                            MessageBox.error(`${message}`);
                        }
                    } catch (parseError) {
                        that.toggleBusy(false);
                        if (error.response?.body) {
                            const errors = error.response.body.split("message");
                            if (errors.length > 1) MessageBox.error(`${errors[1]}`);
                        } else {
                            const errors = error.responseText.split("message");
                            if (errors.length > 1) MessageBox.error(`${errors[1]}`);
                            else if (errors.length == 1) MessageBox.error(`${errors[0]}`);
                            else MessageBox.error(`Unkown Error!`);
                        }
                    }
                }
            });
        },

        toggleBusy: function (bBusy, oControl) {
            if (oControl) {
                // Busy on specific control (like a table, dialog etc.)
                oControl.setBusy(bBusy);
            } else {
                // Global busy indicator
                if (bBusy) {
                    BusyIndicator.show(0);
                } else {
                    BusyIndicator.hide();
                }
            }
        }
    });
});
const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema")
const Wallet = require("../../models/walletSchema")
const Transaction = require("../../models/transactionSchema")



// const orders1 = Order.aggregate([
//     {
//         $lookup: {
//             from: "users", // Collection name (MongoDB uses lowercase & plural)
//             localField: "userId",
//             foreignField: "_id",
//             as: "user"
//         }
//     },
//     {
//         $lookup: {
//             from: "products",
//             localField: "product",
//             foreignField: "_id",
//             as: "product"
//         }
//     },
//     {
//         $lookup: {
//             from: "addresses",
//             localField: "address",
//             foreignField: "_id",
//             as: "address"
//         }
//     },
//     {
//         $unwind: "$user" // Convert array into object
//     },
//     {
//         $unwind: "$product"
//     },
//     {
//         $unwind: "$address"
//     },
//     {
//         $sort: { createdAt: -1 } // Sort by latest order
//     }
// ]);

// console.log("orders1",orders1)

// const getOrders = async (req, res) => {
//     try {
//         const orders = await Order.find()
//         .populate("userId", "name email") // Fetch user details
//         .populate("product", "productName productImages") // Fetch product details
//         .populate("address", "name street city state") // Fetch address details
//         .exec().sort({ createdAt: -1 });

//         res.render("admin/orders", {    
//             orders,
//             title: "Order Management",
//         });
//     } catch (error) {
//         console.error("Error fetching orders:", error);
//         res.status(500).send("Internal Server Error");
//     }
// };
const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10; 
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments();

        const orders = await Order.find()
            .populate('product', 'productName productImages salePrice stock')
            .sort('-createdAt')
            .skip(skip)
            .limit(limit);

        res.render("admin/orders", {
            orders,
            title: "Order Management",
            currentPage: page,
            totalPages: Math.ceil(totalOrders / limit),
            totalOrders,
            limit
        });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send("Internal Server Error");
    }
};

const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await Order.findById(orderId)
            .populate({
                path: "product",
                select: "productName productImages salePrice stock",
            }).populate("userId");


        const addressId = order.address
        const addressData = await Address.findOne({ "address._id": addressId }, { 'address.$': 1 })
        const address = addressData ? addressData.address[0] : null



        if (!order) {
            return res.status(404).send("Order not found");
        }


        res.render("admin/order-details", {
            order,
            title: "Order Details",
            address,

        });
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).send("Internal Server Error");
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Don't allow status change if order is cancelled
        if (order.status === 'cancelled') {
            return res.status(400).json({ success: false, message: "Cannot update cancelled order" });
        }

        if (status === 'delivered') {
            order.deliveredOn = new Date();
        }
        
        // Update order status
        order.status = status;

        await order.save();
        res.json({ success: true, message: "Order status updated successfully" });
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.status !== 'cancelled' && order.status !== 'delivered') {
            order.status = 'cancelled';

            // Return product quantity to stock
            await Product.findByIdAndUpdate(order.product, {
                $inc: { stock: order.quantity }
            });

            await order.save();
            res.json({ success: true, message: "Order cancelled successfully" });
        } else {
            res.status(400).json({ success: false, message: "Order cannot be cancelled" });
        }
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const handleOrderReturn = async (req, res) => {
    try {
        const { orderId, action } = req.body;

        const orderData = await Order.findOne({ _id: orderId });
        if (!orderData) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Restore product stock
        const product = await Product.findById(orderData.product);
        if (product) {
            product.stock += orderData.quantity;
            await product.save();
        }

        // Refund money to wallet
        const wallet = await Wallet.findOne({ userId: orderData.userId });
        if (wallet) {
            wallet.balance += orderData.finalAmount;
            wallet.transactions.push({
                type: 'credit',
                amount: orderData.discountedPrice,
                description: 'Returned amount',
            });

            await wallet.save();

            const transaction = new Transaction({
                userId: orderData.userId,
                amount: orderData.discountedPrice,
                transactionType: "credit",
                paymentMethod: "wallet",
                paymentGateway: "wallet",
                status: "completed",
                purpose: "return",
                description: "Return Order payment to wallet",
                orders: orderData,
                orderIds: { orderId: orderData.orderId },
                walletBalanceAfter: wallet.balance,
            })
            await transaction.save()
        }

        // Update order status
        orderData.status = action === 'approve' ? 'returned' : 'delivered';
        await orderData.save(); // Added missing await

        return res.json({ success: true });
    } catch (error) {
        console.error('Error occurred while processing order return:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


module.exports = {
    getOrders,
    getOrderDetails,
    updateOrderStatus,
    cancelOrder,
    handleOrderReturn
};
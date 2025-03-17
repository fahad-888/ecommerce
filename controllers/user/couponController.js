const Coupon = require("../../models/couponSchema")
const User = require("../../models/userSchema")
const Cart = require("../../models/cartSchema")


function calculateShipping(prize) {
    if (prize < 100) {
        return 10; 
    }
    return 0;
}


const loadcoupon = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const coupons = await Coupon.find({ users: { $nin: [userId] } });
        
        res.render("user/coupon", {
            coupons,
            user:userData
        });

    } catch (error) {
        console.error("Error loading order details:", error);
        res.status(500).render("error", { message: "Internal server error." });
    }
};

const applyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const userId = req.session.user;

        // Validate coupon and calculate discount
        const coupon = await Coupon.findOne({
            couponCode: couponCode,
            users: { $nin: [userId] } 
        });
        
        if (!coupon) {
            return res.json({ success: false, message: "Invalid or expired coupon." });
        }

        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart) {
            return res.json({ success: false, message: "Cart not found." });
        }

        const cartItems = cart.items.filter(item => item.productId && !item.productId.isBlocked && item.productId.stock > 0);
        let subTotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);

        const discountAmount = (subTotal * coupon.offerPrice) / 100;
        let discountedTotal = subTotal - discountAmount;
        let shipping = calculateShipping(subTotal);
        totalAmount = discountedTotal+shipping;
        await Coupon.updateOne({ _id: coupon._id }, { $inc: { usageCount: 1 } });

        return res.json({ success: true, totalAmount, discountAmount,shipping,   subTotal });
         
    } catch (error) {
        console.error("Error applying coupon:", error);
        return res.json({ success: false, message: "Something went wrong." });
    }
};

const clearCoupon = async (req, res) => {
    try {
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error clearing coupon' });
    }
};

const getAvailableCoupons = async (req, res) => {
    try {
        const userId = req.session.user; 
        const currentDate = new Date();

        const coupons = await Coupon.find({isList: "false", users: { $ne: userId } });
        res.json(coupons);
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};



module.exports = {
    applyCoupon,
    clearCoupon,
    loadcoupon,
    getAvailableCoupons
   

}